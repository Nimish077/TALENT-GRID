// Reusable access-control checks shared by controllers and middleware.
//
// Tenant guards always require BOTH:
//   - the membership row to be active
//   - the owning entity (organization / institution) to be active
// Unverified entities are created with pending memberships, so this is what
// keeps them locked out until a platform admin verifies them.

import { ApiError } from "../errors/apiError.js";
import { prisma } from "../lib/prisma.js";

export async function assertOrganizationAccess(
  userId,
  organizationId,
  { roles } = {}
) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!organization) throw new ApiError(404, "Organization not found");

  const membership = await prisma.organizationUser.findUnique({
    where: {
      organization_id_user_id: {
        organization_id: organizationId,
        user_id: userId,
      },
    },
  });
  if (!membership || membership.status !== "active") {
    throw new ApiError(403, "You do not have access to this organization");
  }
  if (organization.status !== "active") {
    throw new ApiError(403, "Organization is not active yet");
  }
  if (roles && !roles.includes(membership.role)) {
    throw new ApiError(
      403,
      "You do not have permission to perform this action"
    );
  }

  return { organization, membership };
}

export async function assertInstitutionAccess(
  userId,
  institutionId,
  { roles } = {}
) {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
  });
  if (!institution) throw new ApiError(404, "Institution not found");

  const membership = await prisma.institutionUser.findUnique({
    where: {
      institution_id_user_id: {
        institution_id: institutionId,
        user_id: userId,
      },
    },
  });
  if (!membership || membership.status !== "active") {
    throw new ApiError(403, "You do not have access to this institution");
  }
  if (institution.status !== "active") {
    throw new ApiError(403, "Institution is not active yet");
  }
  if (roles && !roles.includes(membership.role)) {
    throw new ApiError(
      403,
      "You do not have permission to perform this action"
    );
  }

  return { institution, membership };
}

export async function assertJobAccess(userId, jobId, { roles } = {}) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new ApiError(404, "Job not found");
  const { organization, membership } = await assertOrganizationAccess(
    userId,
    job.organization_id,
    { roles }
  );
  return { job, organization, membership };
}

export async function assertDriveAccess(userId, driveId, { roles } = {}) {
  const drive = await prisma.placementDrive.findUnique({
    where: { id: driveId },
  });
  if (!drive) throw new ApiError(404, "Placement drive not found");
  const { institution, membership } = await assertInstitutionAccess(
    userId,
    drive.institution_id,
    { roles }
  );
  return { drive, institution, membership };
}
