import { apiRequest } from "./api.js";

const qs = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ).toString();
  return query ? `?${query}` : "";
};

export const candidateApi = {
  profile: () => apiRequest("/candidates/me"),
  updateProfile: (body) => apiRequest("/candidates/me", { method: "PATCH", body }),
  skills: () => apiRequest("/candidates/me/skills"),
  addSkill: (body) => apiRequest("/candidates/me/skills", { method: "POST", body }), // { skill_id | skill_name, declared_level }
  updateSkill: (id, declared_level) =>
    apiRequest(`/candidates/me/skills/${id}`, { method: "PATCH", body: { declared_level } }),
  removeSkill: (id) => apiRequest(`/candidates/me/skills/${id}`, { method: "DELETE" }),
};

export const jobsApi = {
  list: (params) => apiRequest(`/jobs${qs(params)}`),
  apply: (jobId) => apiRequest(`/jobs/${jobId}/applications`, { method: "POST", body: {} }),
  applications: (jobId) => apiRequest(`/jobs/${jobId}/applications`),
  invite: (jobId, candidate_profile_id) =>
    apiRequest(`/jobs/${jobId}/invitations`, { method: "POST", body: { candidate_profile_id } }),
  setSkills: (jobId, skills) => apiRequest(`/jobs/${jobId}/skills`, { method: "PUT", body: { skills } }),
  publish: (jobId) => apiRequest(`/jobs/${jobId}/publish`, { method: "POST" }),
  close: (jobId) => apiRequest(`/jobs/${jobId}/close`, { method: "POST" }),
};

export const skillsApi = {
  list: (params) => apiRequest(`/skills${qs(params)}`),
};

export const applicationsApi = {
  mine: () => apiRequest("/applications/mine"),
  withdraw: (id) => apiRequest(`/applications/${id}/withdraw`, { method: "POST" }),
  setStatus: (id, status) => apiRequest(`/applications/${id}/status`, { method: "PATCH", body: { status } }),
};

export const assessmentsApi = {
  list: (params) => apiRequest(`/assessments${qs(params)}`),
  attemptsMine: () => apiRequest("/assessments/attempts/mine"),
  startAttempt: (assessmentId) => apiRequest(`/assessments/${assessmentId}/attempts`, { method: "POST", body: {} }),
  abandonAttempt: (attemptId) => apiRequest(`/assessments/attempts/${attemptId}/abandon`, { method: "POST" }),
  getAttempt: (attemptId) => apiRequest(`/assessments/attempts/${attemptId}`),
  saveAnswer: (attemptId, question_id, option_id) =>
    apiRequest(`/assessments/attempts/${attemptId}/answer`, { method: "PUT", body: { question_id, option_id } }),
  focusLoss: (attemptId) => apiRequest(`/assessments/attempts/${attemptId}/focus-loss`, { method: "POST", body: {} }),
  submit: (attemptId) => apiRequest(`/assessments/attempts/${attemptId}/submit`, { method: "POST", body: {} }),
};

export const talentApi = {
  search: (params) => apiRequest(`/talent${qs(params)}`),
  detail: (candidateProfileId) => apiRequest(`/talent/${candidateProfileId}`),
};

export const organizationsApi = {
  mine: () => apiRequest("/organizations/mine"),
  jobs: (orgId) => apiRequest(`/organizations/${orgId}/jobs`),
  createJob: (orgId, body) => apiRequest(`/organizations/${orgId}/jobs`, { method: "POST", body }),
};

export const institutionsApi = {
  mine: () => apiRequest("/institutions/mine"),
  memberships: (id, params) => apiRequest(`/institutions/${id}/memberships${qs(params)}`),
  drives: (id) => apiRequest(`/institutions/${id}/drives`),
};

export const adminApi = {
  stats: () => apiRequest("/admin/stats"),
  organizations: (params) => apiRequest(`/admin/organizations${qs(params)}`),
  verifyOrganization: (id) => apiRequest(`/admin/organizations/${id}/verify`, { method: "POST", body: {} }),
  suspendOrganization: (id) => apiRequest(`/admin/organizations/${id}/suspend`, { method: "POST", body: {} }),
  institutions: (params) => apiRequest(`/admin/institutions${qs(params)}`),
  verifyInstitution: (id) => apiRequest(`/admin/institutions/${id}/verify`, { method: "POST", body: {} }),
  suspendInstitution: (id) => apiRequest(`/admin/institutions/${id}/suspend`, { method: "POST", body: {} }),
  users: (params) => apiRequest(`/admin/users${qs(params)}`),
  setUserStatus: (id, status) => apiRequest(`/admin/users/${id}/status`, { method: "PATCH", body: { status } }),
};
