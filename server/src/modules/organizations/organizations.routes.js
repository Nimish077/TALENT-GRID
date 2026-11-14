import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import { requireOrgAccess } from "../../middleware/tenant.js";
import { idParam } from "../candidates/candidates.schemas.js";
import { jobCreateSchema } from "../jobs/jobs.schemas.js";
import {
  organizationCreateSchema,
  organizationUpdateSchema,
  memberAddSchema,
  memberUpdateSchema,
} from "./organizations.schemas.js";

const router = Router();

router.use(authenticate);

// Create an additional organization for the authenticated employer.
// The organization and the founder's owner membership start pending until a
// platform admin verifies it.
router.post(
  "/",
  requireRole("employer", "admin"),
  validate({ body: organizationCreateSchema }),
  asyncHandler(async (req, res) => {
    const organization = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({ data: req.body });
      await tx.organizationUser.create({
        data: {
          organization_id: created.id,
          user_id: req.auth.user.id,
          role: "owner",
          status: "pending",
        },
      });
      return created;
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Organization created; awaiting platform verification",
      data: { organization },
    });
  })
);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const memberships = await prisma.organizationUser.findMany({
      where: { user_id: req.auth.user.id },
      include: { organization: true },
      orderBy: { created_at: "asc" },
    });
    return sendSuccess(res, { data: { memberships } });
  })
);

router.get(
  "/:organizationId",
  requireOrgAccess(),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, { data: { organization: req.organization } });
  })
);

router.patch(
  "/:organizationId",
  requireOrgAccess({ roles: ["owner", "admin"] }),
  validate({ body: organizationUpdateSchema }),
  asyncHandler(async (req, res) => {
    const organization = await prisma.organization.update({
      where: { id: req.organization.id },
      data: req.body,
    });
    return sendSuccess(res, {
      message: "Organization updated",
      data: { organization },
    });
  })
);

// ---------------------------------------------------------------------------
// Jobs owned by this organization
// ---------------------------------------------------------------------------

router.post(
  "/:organizationId/jobs",
  requireOrgAccess({ roles: ["owner", "admin"] }),
  validate({ body: jobCreateSchema }),
  asyncHandler(async (req, res) => {
    const job = await prisma.job.create({
      data: {
        ...req.body,
        organization_id: req.organization.id,
        created_by_user_id: req.auth.user.id,
      },
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Job created",
      data: { job },
    });
  })
);

router.get(
  "/:organizationId/jobs",
  requireOrgAccess(),
  asyncHandler(async (req, res) => {
    const jobs = await prisma.job.findMany({
      where: { organization_id: req.organization.id },
      include: { _count: { select: { applications: true } } },
      orderBy: { created_at: "desc" },
    });
    return sendSuccess(res, { data: { jobs } });
  })
);

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

router.get(
  "/:organizationId/members",
  requireOrgAccess(),
  asyncHandler(async (req, res) => {
    const members = await prisma.organizationUser.findMany({
      where: { organization_id: req.organization.id },
      include: {
        user: {
          select: { id: true, email: true, full_name: true, role: true },
        },
      },
      orderBy: { created_at: "asc" },
    });
    return sendSuccess(res, { data: { members } });
  })
);

router.post(
  "/:organizationId/members",
  requireOrgAccess({ roles: ["owner", "admin"] }),
  validate({ body: memberAddSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { email: req.body.email },
    });
    if (!user) {
      throw new ApiError(404, "No registered user with that email address");
    }
    const member = await prisma.organizationUser.create({
      data: {
        organization_id: req.organization.id,
        user_id: user.id,
        role: req.body.role,
        status: "active",
      },
      include: {
        user: {
          select: { id: true, email: true, full_name: true, role: true },
        },
      },
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Member added",
      data: { member },
    });
  })
);

async function loadMembershipOrThrow(organizationId, userId) {
  const membership = await prisma.organizationUser.findUnique({
    where: {
      organization_id_user_id: {
        organization_id: organizationId,
        user_id: userId,
      },
    },
  });
  if (!membership) throw new ApiError(404, "Member not found");
  return membership;
}

async function assertOwnerChangeAllowed(organizationId, target, nextState) {
  const removingOwnership =
    target.role === "owner" &&
    ((nextState.role !== undefined && nextState.role !== "owner") ||
      (nextState.status !== undefined && nextState.status !== "active"));
  if (!removingOwnership) return;

  const activeOwners = await prisma.organizationUser.count({
    where: { organization_id: organizationId, role: "owner", status: "active" },
  });
  if (activeOwners <= 1) {
    throw new ApiError(
      409,
      "The last active owner cannot be demoted or deactivated"
    );
  }
}

router.patch(
  "/:organizationId/members/:userId",
  requireOrgAccess({ roles: ["owner", "admin"] }),
  validate({ params: idParam("userId"), body: memberUpdateSchema }),
  asyncHandler(async (req, res) => {
    const target = await loadMembershipOrThrow(
      req.organization.id,
      req.params.userId
    );

    if (target.user_id === req.auth.user.id) {
      throw new ApiError(400, "You cannot modify your own membership");
    }
    if (target.role === "owner" && req.orgMembership.role !== "owner") {
      throw new ApiError(403, "Only an owner can modify another owner");
    }
    await assertOwnerChangeAllowed(req.organization.id, target, req.body);

    const member = await prisma.organizationUser.update({
      where: { id: target.id },
      data: req.body,
      include: {
        user: {
          select: { id: true, email: true, full_name: true, role: true },
        },
      },
    });
    return sendSuccess(res, { message: "Member updated", data: { member } });
  })
);

router.delete(
  "/:organizationId/members/:userId",
  requireOrgAccess({ roles: ["owner", "admin"] }),
  validate({ params: idParam("userId") }),
  asyncHandler(async (req, res) => {
    const target = await loadMembershipOrThrow(
      req.organization.id,
      req.params.userId
    );

    if (target.user_id === req.auth.user.id) {
      throw new ApiError(400, "You cannot remove your own membership");
    }
    if (target.role === "owner" && req.orgMembership.role !== "owner") {
      throw new ApiError(403, "Only an owner can remove another owner");
    }
    await assertOwnerChangeAllowed(req.organization.id, target, {
      role: "member",
    });

    await prisma.organizationUser.delete({ where: { id: target.id } });
    return sendSuccess(res, { message: "Member removed" });
  })
);

export default router;
