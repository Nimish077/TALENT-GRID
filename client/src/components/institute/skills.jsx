import { Badge } from "../dashboard/primitives.jsx";
import { capitalize } from "../../lib/format.js";
import { READINESS, readinessOf } from "../../lib/readiness.js";

export function ReadinessBadge({ student }) {
  const r = READINESS[readinessOf(student)];
  return <Badge className={r.style}>{r.label}</Badge>;
}

const MAX_CHIPS = 3;

export function VerifiedSkills({ skills }) {
  if (!skills || !skills.profile_id) {
    return <p className="mt-1.5 text-xs text-text-muted">Not linked to a candidate account</p>;
  }
  const verified = skills.verified ?? [];
  if (verified.length === 0) return <p className="mt-1.5 text-xs text-text-muted">No verified skills yet</p>;
  const extra = Math.max(skills.verified_count ?? 0, verified.length) - MAX_CHIPS;
  return (
    <ul aria-label="Verified skills" className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {verified.slice(0, MAX_CHIPS).map((skill) => (
        <li key={skill.name} className="rounded bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent-dark">
          {skill.name} · {capitalize(skill.level)}
        </li>
      ))}
      {extra > 0 && <li className="text-xs text-text-secondary">+{extra} more</li>}
    </ul>
  );
}
