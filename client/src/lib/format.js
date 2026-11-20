export const LEVELS = ["beginner", "intermediate", "advanced"];

export const capitalize = (value = "") =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ") : "";

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export const firstName = (fullName = "") => fullName.trim().split(/\s+/)[0] ?? "";

export function initials(fullName = "") {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Salaries are stored as annual INR amounts (Decimal, serialised as a string).
export function formatSalaryLpa(min, max) {
  const toLpa = (n) => {
    const value = Number(n) / 100000;
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  };
  const has = (v) => v !== null && v !== undefined && v !== "";
  if (has(min) && has(max)) return `₹${toLpa(min)}–${toLpa(max)} LPA`;
  if (has(min)) return `₹${toLpa(min)}+ LPA`;
  if (has(max)) return `Up to ₹${toLpa(max)} LPA`;
  return null;
}

export const meetsLevel = (have, need) => {
  const haveIndex = LEVELS.indexOf(have);
  return haveIndex >= 0 && haveIndex >= LEVELS.indexOf(need);
};

// Profile completeness: 8 equally weighted signals. Returns the percentage
// and the first missing item, used for the "Add X to reach 100%" hint.
export function profileCompleteness(profile, counts) {
  const checks = [
    ["a headline", Boolean(profile?.headline)],
    ["a bio", Boolean(profile?.bio)],
    ["your location", Boolean(profile?.location)],
    ["education", (counts?.educations ?? 0) > 0],
    ["experience", (counts?.experiences ?? 0) > 0],
    ["projects", (counts?.projects ?? 0) > 0],
    ["skills", (counts?.skills ?? 0) > 0],
    ["a resume", Boolean(profile?.resume_url)],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  const missing = checks.find(([, ok]) => !ok)?.[0] ?? null;
  return { percent: Math.round((done / checks.length) * 100), missing };
}

export const applicationStatusStyle = {
  applied: "bg-brand-light text-brand",
  shortlisted: "bg-purple-100 text-purple-700",
  selected: "bg-accent-muted text-accent-dark",
  rejected: "bg-error-light text-error",
  withdrawn: "bg-surface-muted text-text-secondary",
};
