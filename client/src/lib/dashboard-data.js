import { meetsLevel } from "./format.js";

// Rank published jobs by how many required skills the candidate holds.
export function rankJobs(jobs, skills) {
  const bySkill = new Map(skills.map((s) => [s.skill_id, s]));
  return jobs
    .map((job) => {
      const requirements = job.skills.map((req) => {
        const mine = bySkill.get(req.skill_id);
        const verified = mine?.verification_status === "verified" && meetsLevel(mine.verified_level, req.required_level);
        return { ...req, owned: Boolean(mine), verified };
      });
      return { job, requirements, score: requirements.filter((r) => r.owned).length };
    })
    .sort((a, b) => b.score - a.score);
}

// Real application statuses only: applied -> shortlisted -> selected | rejected.
export function pipelineStages(applications) {
  const count = (...statuses) => applications.filter((a) => statuses.includes(a.status)).length;
  return [
    { label: "Applied", value: applications.length, color: "bg-brand" },
    { label: "Shortlisted", value: count("shortlisted", "selected"), color: "bg-purple-400" },
    { label: "Selected", value: count("selected"), color: "bg-accent" },
    { label: "Rejected", value: count("rejected"), color: "bg-error" },
  ];
}

