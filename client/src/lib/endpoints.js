import { apiRequest } from "./api.js";

const qs = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
  ).toString();
  return query ? `?${query}` : "";
};

export const candidateApi = {
  profile: () => apiRequest("/candidates/me"),
  skills: () => apiRequest("/candidates/me/skills"),
};

export const jobsApi = {
  list: (params) => apiRequest(`/jobs${qs(params)}`),
  apply: (jobId) => apiRequest(`/jobs/${jobId}/applications`, { method: "POST", body: {} }),
  applications: (jobId) => apiRequest(`/jobs/${jobId}/applications`),
};

export const applicationsApi = {
  mine: () => apiRequest("/applications/mine"),
};

export const assessmentsApi = {
  list: (params) => apiRequest(`/assessments${qs(params)}`),
};

export const organizationsApi = {
  mine: () => apiRequest("/organizations/mine"),
  jobs: (orgId) => apiRequest(`/organizations/${orgId}/jobs`),
};

export const institutionsApi = {
  mine: () => apiRequest("/institutions/mine"),
  memberships: (id, params) => apiRequest(`/institutions/${id}/memberships${qs(params)}`),
  drives: (id) => apiRequest(`/institutions/${id}/drives`),
};
