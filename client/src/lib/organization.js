import { institutionsApi, organizationsApi } from "./endpoints.js";

const isActive = (status) => status === "active";

// The signed-in employer's organization, plus whether it may act yet
// (pending / suspended organizations are locked out by the API).
export async function loadEmployerOrganization() {
  const { memberships } = await organizationsApi.mine();
  const membership = memberships.find((m) => isActive(m.status)) ?? memberships[0];
  if (!membership) return { organization: null, canManage: false, pending: false };
  const { organization } = membership;
  const canManage = isActive(membership.status) && isActive(organization.status);
  return {
    organization,
    role: membership.role,
    canManage,
    pending: !canManage,
    suspended: organization.status === "suspended" || membership.status === "suspended",
  };
}

export async function loadInstituteInstitution() {
  const { memberships } = await institutionsApi.mine();
  const membership = memberships.find((m) => isActive(m.status)) ?? memberships[0];
  if (!membership) return { institution: null, canManage: false, pending: false };
  const { institution } = membership;
  const active = isActive(membership.status) && isActive(institution.status);
  return {
    institution,
    role: membership.role,
    canManage: active && membership.role !== "member",
    pending: !active,
    suspended: institution.status === "suspended" || membership.status === "suspended",
  };
}
