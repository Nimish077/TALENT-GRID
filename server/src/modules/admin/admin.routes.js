// Platform administration: user moderation and entity verification.
// Admin accounts are bootstrapped via `npm run admin:create` — there is no
// public admin registration.

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import { parsePagination, paginatedData } from "../../utils/pagination.js";
import { idParam } from "../candidates/candidates.schemas.js";

const router = Router();

router.use(authenticate, requireRole("admin"));

const listQuerySchema = z.object({
  status: z.string().trim().max(40).optional(),
  role: z.string().trim().max(40).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

router.get(
  "/users",
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = parsePagination(req.validatedQuery);
    const { status, role, search } = req.validatedQuery;

    const where = {
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
      ...(search ? { email: { contains: search, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          full_name: true,
          role: true,
          status: true,
          email_verified_at: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);
    return sendSuccess(res, { data: paginatedData(items, total, page, limit) });
  })
);

router.patch(
  "/users/:userId/status",
  validate({
    params: idParam("userId"),
    body: z.object({ status: z.enum(["active", "suspended"]) }),
  }),
  asyncHandler(async (req, res) => {
    if (req.params.userId === req.auth.user.id) {
      throw new ApiError(400, "You cannot change your own account status");
    }
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
    });
    if (!user) throw new ApiError(404, "User not found");

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: user.id },
        data: { status: req.body.status },
        select: {
          id: true,
          email: true,
          full_name: true,
          role: true,
          status: true,
        },
      });
      if (req.body.status === "suspended") {
        await tx.session.updateMany({
          where: { user_id: user.id, revoked_at: null },
          data: { revoked_at: new Date(), revoke_reason: "admin" },
        });
      }
      return result;
    });
    return sendSuccess(res, {
      message: "User status updated",
      data: { user: updated },
    });
  })
);

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

router.get(
  "/organizations",
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = parsePagination(req.validatedQuery);
    const { status, search } = req.validatedQuery;
    const where = {
      ...(status ? { status } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: { _count: { select: { users: true, jobs: true } } },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.organization.count({ where }),
    ]);
    return sendSuccess(res, { data: paginatedData(items, total, page, limit) });
  })
);

router.post(
  "/organizations/:organizationId/verify",
  validate({ params: idParam("organizationId") }),
  asyncHandler(async (req, res) => {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.organizationId },
    });
    if (!organization) throw new ApiError(404, "Organization not found");
    if (organization.status === "active") {
      throw new ApiError(409, "Organization is already active");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.organization.update({
        where: { id: organization.id },
        data: { status: "active" },
      });
      await tx.organizationUser.updateMany({
        where: {
          organization_id: organization.id,
          role: "owner",
          status: "pending",
        },
        data: { status: "active" },
      });
      return result;
    });
    return sendSuccess(res, {
      message: "Organization verified",
      data: { organization: updated },
    });
  })
);

router.post(
  "/organizations/:organizationId/suspend",
  validate({ params: idParam("organizationId") }),
  asyncHandler(async (req, res) => {
    const organization = await prisma.organization.update({
      where: { id: req.params.organizationId },
      data: { status: "suspended" },
    });
    return sendSuccess(res, {
      message: "Organization suspended",
      data: { organization },
    });
  })
);

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------

router.get(
  "/institutions",
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = parsePagination(req.validatedQuery);
    const { status, search } = req.validatedQuery;
    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.institution.findMany({
        where,
        include: {
          _count: { select: { users: true, memberships: true, drives: true } },
        },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.institution.count({ where }),
    ]);
    return sendSuccess(res, { data: paginatedData(items, total, page, limit) });
  })
);

router.post(
  "/institutions/:institutionId/verify",
  validate({ params: idParam("institutionId") }),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.findUnique({
      where: { id: req.params.institutionId },
    });
    if (!institution) throw new ApiError(404, "Institution not found");
    if (institution.status === "active") {
      throw new ApiError(409, "Institution is already active");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.institution.update({
        where: { id: institution.id },
        data: { status: "active" },
      });
      await tx.institutionUser.updateMany({
        where: {
          institution_id: institution.id,
          role: "owner",
          status: "pending",
        },
        data: { status: "active" },
      });
      return result;
    });
    return sendSuccess(res, {
      message: "Institution verified",
      data: { institution: updated },
    });
  })
);

router.post(
  "/institutions/:institutionId/suspend",
  validate({ params: idParam("institutionId") }),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.update({
      where: { id: req.params.institutionId },
      data: { status: "suspended" },
    });
    return sendSuccess(res, {
      message: "Institution suspended",
      data: { institution },
    });
  })
);

export default router;
