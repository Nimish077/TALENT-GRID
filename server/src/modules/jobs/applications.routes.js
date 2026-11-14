// Application lifecycle.
//
// Employer transitions follow an explicit matrix:
//   applied     -> shortlisted | rejected
//   shortlisted -> selected | rejected
// Everything else (including any move out of withdrawn/rejected/selected) is
// rejected with 409. Candidates may withdraw while applied or shortlisted.

import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import { assertOrganizationAccess } from "../../services/access.js";
import { getProfileForUser } from "../candidates/candidates.service.js";
import { idParam } from "../candidates/candidates.schemas.js";
import { applicationStatusSchema } from "./jobs.schemas.js";

const router = Router();

router.use(authenticate);

const EMPLOYER_TRANSITIONS = {
  applied: ["shortlisted", "rejected"],
  shortlisted: ["selected", "rejected"],
};

const CANDIDATE_WITHDRAWABLE = new Set(["applied", "shortlisted"]);

router.get(
  "/mine",
  requireRole("candidate"),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const applications = await prisma.jobApplication.findMany({
      where: { candidate_profile_id: profile.id },
      include: {
        job: {
          include: {
            organization: { select: { id: true, name: true, logo_url: true } },
          },
        },
      },
      orderBy: { applied_at: "desc" },
    });
    return sendSuccess(res, { data: { applications } });
  })
);

router.get(
  "/:applicationId",
  validate({ params: idParam("applicationId") }),
  asyncHandler(async (req, res) => {
    const application = await prisma.jobApplication.findUnique({
      where: { id: req.params.applicationId },
      include: {
        job: {
          include: { organization: { select: { id: true, name: true } } },
        },
        candidate_profile: true,
      },
    });
    if (!application) throw new ApiError(404, "Application not found");

    const isOwner =
      req.auth.user.role === "candidate" &&
      application.candidate_profile.user_id === req.auth.user.id;
    if (!isOwner) {
      await assertOrganizationAccess(
        req.auth.user.id,
        application.job.organization_id,
        {
          roles: ["owner", "admin", "member"],
        }
      );
    }
    return sendSuccess(res, { data: { application } });
  })
);

router.post(
  "/:applicationId/withdraw",
  requireRole("candidate"),
  validate({ params: idParam("applicationId") }),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const application = await prisma.jobApplication.findFirst({
      where: { id: req.params.applicationId, candidate_profile_id: profile.id },
    });
    if (!application) throw new ApiError(404, "Application not found");
    if (!CANDIDATE_WITHDRAWABLE.has(application.status)) {
      throw new ApiError(
        409,
        `An application in status "${application.status}" cannot be withdrawn`
      );
    }
    const updated = await prisma.jobApplication.update({
      where: { id: application.id },
      data: { status: "withdrawn" },
    });
    return sendSuccess(res, {
      message: "Application withdrawn",
      data: { application: updated },
    });
  })
);

router.patch(
  "/:applicationId/status",
  requireRole("employer", "admin"),
  validate({ params: idParam("applicationId"), body: applicationStatusSchema }),
  asyncHandler(async (req, res) => {
    const application = await prisma.jobApplication.findUnique({
      where: { id: req.params.applicationId },
      include: { job: true },
    });
    if (!application) throw new ApiError(404, "Application not found");

    await assertOrganizationAccess(
      req.auth.user.id,
      application.job.organization_id,
      {
        roles: ["owner", "admin", "member"],
      }
    );

    const allowed = EMPLOYER_TRANSITIONS[application.status] ?? [];
    if (!allowed.includes(req.body.status)) {
      throw new ApiError(
        409,
        `Cannot move application from "${application.status}" to "${req.body.status}"`
      );
    }

    const updated = await prisma.jobApplication.update({
      where: { id: application.id },
      data: { status: req.body.status },
    });
    return sendSuccess(res, {
      message: "Application status updated",
      data: { application: updated },
    });
  })
);

export default router;
