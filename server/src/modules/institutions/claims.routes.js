// Institution membership claims: prove ownership of an enrollment row via a
// 6-digit OTP sent to the email the institution has on file.
//
// - Codes are stored only as HMAC hashes bound to (claim membership, email).
// - A claim expires after OTP_TTL_MINUTES and locks after OTP_MAX_ATTEMPTS
//   wrong entries. Requesting a new code replaces the pending claim.
// - Only one pending claim per membership is allowed (partial unique index).

import { Router } from "express";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import {
  otpSendLimiter,
  otpVerifyLimiter,
} from "../../middleware/rateLimits.js";
import { generateOtp, hashOtp, verifyOtp } from "../../utils/otp.js";
import { mailer } from "../../services/mailer.js";
import { idParam } from "../candidates/candidates.schemas.js";
import {
  claimCreateSchema,
  claimVerifySchema,
} from "./institutions.schemas.js";

const router = Router();

router.use(authenticate);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const claims = await prisma.institutionMembershipClaim.findMany({
      where: { user_id: req.auth.user.id },
      include: {
        membership: {
          include: {
            institution: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
    return sendSuccess(res, { data: { claims } });
  })
);

router.post(
  "/",
  requireRole("candidate"),
  otpSendLimiter,
  validate({ body: claimCreateSchema }),
  asyncHandler(async (req, res) => {
    const { institution_id, enrollment_id, requested_email } = req.body;

    const membership = await prisma.institutionMembership.findUnique({
      where: {
        institution_id_enrollment_id: { institution_id, enrollment_id },
      },
    });
    if (!membership) {
      throw new ApiError(
        404,
        "No membership found for that institution and enrollment id"
      );
    }
    if (
      membership.verification_status === "verified" &&
      membership.user_id &&
      membership.user_id !== req.auth.user.id
    ) {
      throw new ApiError(409, "This membership has already been claimed");
    }
    if (
      membership.verification_status === "verified" &&
      membership.user_id === req.auth.user.id
    ) {
      throw new ApiError(
        409,
        "This membership is already linked to your account"
      );
    }

    const registeredEmails = [
      membership.institutional_email,
      membership.personal_email,
    ]
      .filter(Boolean)
      .map((email) => email.toLowerCase());
    if (!registeredEmails.includes(requested_email)) {
      throw new ApiError(
        403,
        "The requested email does not match the emails registered on this membership"
      );
    }

    const otp = generateOtp();
    const context = `${membership.id}:${requested_email}`;
    const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60_000);

    const pending = await prisma.institutionMembershipClaim.findFirst({
      where: { institution_membership_id: membership.id, status: "pending" },
    });

    const claim = pending
      ? await prisma.institutionMembershipClaim.update({
          where: { id: pending.id },
          data: {
            requested_email,
            otp_hash: hashOtp(otp, context),
            otp_expires_at: expiresAt,
            otp_attempts: 0,
            user_id: req.auth.user.id,
          },
        })
      : await prisma.institutionMembershipClaim.create({
          data: {
            institution_membership_id: membership.id,
            requested_email,
            otp_hash: hashOtp(otp, context),
            otp_expires_at: expiresAt,
            user_id: req.auth.user.id,
          },
        });

    await mailer.send({
      to: requested_email,
      subject: "TalentGrid institution membership verification",
      text: `Your TalentGrid verification code is ${otp}. It expires in ${env.otpTtlMinutes} minutes.`,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Verification code sent",
      data: {
        claim: {
          id: claim.id,
          requested_email: claim.requested_email,
          otp_expires_at: claim.otp_expires_at,
        },
      },
    });
  })
);

router.post(
  "/:claimId/verify",
  otpVerifyLimiter,
  validate({ params: idParam("claimId"), body: claimVerifySchema }),
  asyncHandler(async (req, res) => {
    const claim = await prisma.institutionMembershipClaim.findUnique({
      where: { id: req.params.claimId },
      include: { membership: true },
    });
    if (!claim || claim.user_id !== req.auth.user.id) {
      throw new ApiError(404, "Claim not found");
    }
    if (claim.status === "verified") {
      throw new ApiError(409, "Claim has already been verified");
    }
    if (claim.status === "locked") {
      throw new ApiError(
        409,
        "This claim is locked; request a new verification code"
      );
    }
    if (claim.status === "expired" || claim.otp_expires_at <= new Date()) {
      await prisma.institutionMembershipClaim.update({
        where: { id: claim.id },
        data: { status: "expired" },
      });
      throw new ApiError(
        410,
        "Verification code has expired; request a new one"
      );
    }
    if (
      claim.membership.user_id &&
      claim.membership.user_id !== req.auth.user.id
    ) {
      throw new ApiError(
        409,
        "This membership is already linked to another account"
      );
    }

    const context = `${claim.membership.id}:${claim.requested_email}`;
    if (!verifyOtp(req.body.otp, context, claim.otp_hash)) {
      const attempts = claim.otp_attempts + 1;
      await prisma.institutionMembershipClaim.update({
        where: { id: claim.id },
        data: {
          otp_attempts: attempts,
          status: attempts >= env.otpMaxAttempts ? "locked" : "pending",
        },
      });
      throw new ApiError(400, "Invalid verification code");
    }

    const result = await prisma.$transaction(async (tx) => {
      const verifiedClaim = await tx.institutionMembershipClaim.update({
        where: { id: claim.id },
        data: { status: "verified", verified_at: new Date() },
      });
      const membership = await tx.institutionMembership.update({
        where: { id: claim.membership.id },
        data: {
          user_id: req.auth.user.id,
          verification_status: "verified",
          verification_source: "email_otp",
          verified_at: new Date(),
        },
      });
      return { claim: verifiedClaim, membership };
    });

    return sendSuccess(res, { message: "Membership verified", data: result });
  })
);

export default router;
