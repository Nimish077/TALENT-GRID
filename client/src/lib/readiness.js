export const READINESS = {
  job_ready: { label: "Job-ready", style: "bg-accent-muted text-accent-dark" },
  developing: { label: "Developing", style: "bg-warning-light text-warning" },
  not_started: { label: "Not started", style: "bg-surface-muted text-text-secondary" },
};

// 0 verified skills = not started, 1 = developing, 2+ = job-ready.
export function readinessOf(student) {
  const count = student?.skills?.verified_count ?? 0;
  if (count >= 2) return "job_ready";
  if (count === 1) return "developing";
  return "not_started";
}
