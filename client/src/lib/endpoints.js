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
