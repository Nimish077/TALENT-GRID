import { asyncHandler } from "../utils/asyncHandler.js";
import {
  assertOrganizationAccess,
  assertInstitutionAccess,
} from "../services/access.js";

// Route-param based tenant guards. The id is read from `req.params[field]`
// (defaults match the route conventions: :organizationId / :institutionId).
export function requireOrgAccess({ roles, field = "organizationId" } = {}) {
  return asyncHandler(async (req, res, next) => {
    const { organization, membership } = await assertOrganizationAccess(
      req.auth.user.id,
      req.params[field],
      { roles }
    );
    req.organization = organization;
    req.orgMembership = membership;
    next();
  });
}

export function requireInstitutionAccess({
  roles,
  field = "institutionId",
} = {}) {
  return asyncHandler(async (req, res, next) => {
    const { institution, membership } = await assertInstitutionAccess(
      req.auth.user.id,
      req.params[field],
      { roles }
    );
    req.institution = institution;
    req.institutionMembership = membership;
    next();
  });
}
