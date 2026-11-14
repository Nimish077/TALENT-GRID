import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import { requireInstitutionAccess } from "../../middleware/tenant.js";
import { parsePagination, paginatedData } from "../../utils/pagination.js";
import { idParam } from "../candidates/candidates.schemas.js";
import {
  institutionCreateSchema,
  institutionUpdateSchema,
  membershipCreateSchema,
  membershipUpdateSchema,
  membershipListQuerySchema,
  importCreateSchema,
  institutionMemberAddSchema,
  institutionMemberUpdateSchema,
} from "./institutions.schemas.js";

const router = Router();

router.use(authenticate);

// Create an institution; the founder becomes a pending owner until a platform
// admin verifies the institution.
router.post(
  "/",
  requireRole("institute", "admin"),
  validate({ body: institutionCreateSchema }),
  asyncHandler(async (req, res) => {
    const institution = await prisma.$transaction(async (tx) => {
      const created = await tx.institution.create({ data: req.body });
      await tx.institutionUser.create({
        data: {
          institution_id: created.id,
          user_id: req.auth.user.id,
          role: "owner",
          status: "pending",
        },
      });
      return created;
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Institution created; awaiting platform verification",
      data: { institution },
    });
  })
);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const memberships = await prisma.institutionUser.findMany({
      where: { user_id: req.auth.user.id },
      include: { institution: true },
      orderBy: { created_at: "asc" },
    });
    return sendSuccess(res, { data: { memberships } });
  })
);

router.get(
  "/:institutionId",
  requireInstitutionAccess(),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, { data: { institution: req.institution } });
  })
);

router.patch(
  "/:institutionId",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ body: institutionUpdateSchema }),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.update({
      where: { id: req.institution.id },
      data: req.body,
    });
    return sendSuccess(res, {
      message: "Institution updated",
      data: { institution },
    });
  })
);

// ---------------------------------------------------------------------------
// Staff members
// ---------------------------------------------------------------------------

router.get(
  "/:institutionId/members",
  requireInstitutionAccess(),
  asyncHandler(async (req, res) => {
    const members = await prisma.institutionUser.findMany({
      where: { institution_id: req.institution.id },
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
  "/:institutionId/members",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ body: institutionMemberAddSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { email: req.body.email },
    });
    if (!user)
      throw new ApiError(404, "No registered user with that email address");
    const member = await prisma.institutionUser.create({
      data: {
        institution_id: req.institution.id,
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

async function loadInstitutionMember(institutionId, userId) {
  const member = await prisma.institutionUser.findUnique({
    where: {
      institution_id_user_id: {
        institution_id: institutionId,
        user_id: userId,
      },
    },
  });
  if (!member) throw new ApiError(404, "Member not found");
  return member;
}

async function assertOwnerChangeAllowed(institutionId, target, nextState) {
  const removingOwnership =
    target.role === "owner" &&
    ((nextState.role !== undefined && nextState.role !== "owner") ||
      (nextState.status !== undefined && nextState.status !== "active"));
  if (!removingOwnership) return;

  const activeOwners = await prisma.institutionUser.count({
    where: { institution_id: institutionId, role: "owner", status: "active" },
  });
  if (activeOwners <= 1) {
    throw new ApiError(
      409,
      "The last active owner cannot be demoted or deactivated"
    );
  }
}

router.patch(
  "/:institutionId/members/:userId",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ params: idParam("userId"), body: institutionMemberUpdateSchema }),
  asyncHandler(async (req, res) => {
    const target = await loadInstitutionMember(
      req.institution.id,
      req.params.userId
    );
    if (target.user_id === req.auth.user.id) {
      throw new ApiError(400, "You cannot modify your own membership");
    }
    if (target.role === "owner" && req.institutionMembership.role !== "owner") {
      throw new ApiError(403, "Only an owner can modify another owner");
    }
    await assertOwnerChangeAllowed(req.institution.id, target, req.body);

    const member = await prisma.institutionUser.update({
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
  "/:institutionId/members/:userId",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ params: idParam("userId") }),
  asyncHandler(async (req, res) => {
    const target = await loadInstitutionMember(
      req.institution.id,
      req.params.userId
    );
    if (target.user_id === req.auth.user.id) {
      throw new ApiError(400, "You cannot remove your own membership");
    }
    if (target.role === "owner" && req.institutionMembership.role !== "owner") {
      throw new ApiError(403, "Only an owner can remove another owner");
    }
    await assertOwnerChangeAllowed(req.institution.id, target, {
      role: "member",
    });
    await prisma.institutionUser.delete({ where: { id: target.id } });
    return sendSuccess(res, { message: "Member removed" });
  })
);

// ---------------------------------------------------------------------------
// Student memberships
// ---------------------------------------------------------------------------

router.get(
  "/:institutionId/memberships",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ query: membershipListQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = parsePagination(req.validatedQuery);
    const { search, membership_status, verification_status } =
      req.validatedQuery;

    const where = {
      institution_id: req.institution.id,
      ...(membership_status ? { membership_status } : {}),
      ...(verification_status ? { verification_status } : {}),
      ...(search
        ? {
            OR: [
              { full_name: { contains: search, mode: "insensitive" } },
              { enrollment_id: { contains: search, mode: "insensitive" } },
              {
                institutional_email: { contains: search, mode: "insensitive" },
              },
              { personal_email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.institutionMembership.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.institutionMembership.count({ where }),
    ]);
    return sendSuccess(res, { data: paginatedData(items, total, page, limit) });
  })
);

router.post(
  "/:institutionId/memberships",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ body: membershipCreateSchema }),
  asyncHandler(async (req, res) => {
    const membership = await prisma.institutionMembership.create({
      data: { ...req.body, institution_id: req.institution.id },
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Membership created",
      data: { membership },
    });
  })
);

router.patch(
  "/:institutionId/memberships/:membershipId",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ params: idParam("membershipId"), body: membershipUpdateSchema }),
  asyncHandler(async (req, res) => {
    const membership = await prisma.institutionMembership.findFirst({
      where: {
        id: req.params.membershipId,
        institution_id: req.institution.id,
      },
    });
    if (!membership) throw new ApiError(404, "Membership not found");
    const updated = await prisma.institutionMembership.update({
      where: { id: membership.id },
      data: req.body,
    });
    return sendSuccess(res, {
      message: "Membership updated",
      data: { membership: updated },
    });
  })
);

// Institute-attested verification of a membership row.
router.post(
  "/:institutionId/memberships/:membershipId/verify",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ params: idParam("membershipId") }),
  asyncHandler(async (req, res) => {
    const membership = await prisma.institutionMembership.findFirst({
      where: {
        id: req.params.membershipId,
        institution_id: req.institution.id,
      },
    });
    if (!membership) throw new ApiError(404, "Membership not found");
    if (membership.verification_status === "verified") {
      throw new ApiError(409, "Membership is already verified");
    }
    const updated = await prisma.institutionMembership.update({
      where: { id: membership.id },
      data: {
        verification_status: "verified",
        verification_source: "institute",
        verified_at: new Date(),
      },
    });
    return sendSuccess(res, {
      message: "Membership verified",
      data: { membership: updated },
    });
  })
);

router.delete(
  "/:institutionId/memberships/:membershipId",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ params: idParam("membershipId") }),
  asyncHandler(async (req, res) => {
    const membership = await prisma.institutionMembership.findFirst({
      where: {
        id: req.params.membershipId,
        institution_id: req.institution.id,
      },
    });
    if (!membership) throw new ApiError(404, "Membership not found");
    await prisma.institutionMembership.delete({ where: { id: membership.id } });
    return sendSuccess(res, { message: "Membership deleted" });
  })
);

// ---------------------------------------------------------------------------
// Bulk imports (JSON rows; no file upload in this iteration). Imported rows
// are institute-attested, so they are created verified with source
// "institution_import".
// ---------------------------------------------------------------------------

router.post(
  "/:institutionId/imports",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ body: importCreateSchema }),
  asyncHandler(async (req, res) => {
    const { file_name, file_url, rows } = req.body;

    const importRecord = await prisma.institutionImport.create({
      data: {
        institution_id: req.institution.id,
        uploaded_by_user_id: req.auth.user.id,
        file_name: file_name ?? null,
        file_url: file_url ?? null,
        status: "processing",
        total_rows: rows.length,
      },
    });

    let successful = 0;
    for (const row of rows) {
      try {
        await prisma.institutionMembership.create({
          data: {
            institution_id: req.institution.id,
            import_id: importRecord.id,
            ...row,
            verification_status: "verified",
            verification_source: "institution_import",
            verified_at: new Date(),
          },
        });
        successful += 1;
      } catch {
        // Duplicate (institution_id, enrollment_id) or invalid row — counted
        // as failed; partial imports are expected.
      }
    }

    const failed = rows.length - successful;
    const status =
      failed === 0 ? "completed" : successful === 0 ? "failed" : "partial";

    const updated = await prisma.institutionImport.update({
      where: { id: importRecord.id },
      data: {
        successful_rows: successful,
        failed_rows: failed,
        status,
        completed_at: new Date(),
      },
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Import processed",
      data: { import: updated },
    });
  })
);

router.get(
  "/:institutionId/imports",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  asyncHandler(async (req, res) => {
    const imports = await prisma.institutionImport.findMany({
      where: { institution_id: req.institution.id },
      orderBy: { created_at: "desc" },
    });
    return sendSuccess(res, { data: { imports } });
  })
);

export default router;
