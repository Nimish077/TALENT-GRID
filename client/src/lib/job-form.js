const LPA = 100000;

const toNumber = (value) => (value === "" || value == null ? null : Number(value));

// Turns the post-a-job form (salary in LPA, blank strings) into the API body
// (annual INR, nulls). Returns `{ payload }` or `{ error }`.
export function buildJobPayload(form) {
  const min = toNumber(form.salaryMinLpa);
  const max = toNumber(form.salaryMaxLpa);
  if ([min, max].some((n) => n !== null && (Number.isNaN(n) || n < 0))) {
    return { error: "Salary must be a positive number." };
  }
  if (min !== null && max !== null && min > max) {
    return { error: "Minimum salary can't be higher than maximum salary." };
  }

  const text = (value) => (value?.trim() ? value.trim() : null);
  return {
    payload: {
      title: form.title.trim(),
      description: text(form.description),
      location: text(form.location),
      work_mode: form.workMode || null,
      employment_type: form.employmentType || null,
      experience_level: text(form.experienceLevel),
      salary_min: min === null ? null : Math.round(min * LPA),
      salary_max: max === null ? null : Math.round(max * LPA),
      application_deadline: form.deadline ? new Date(`${form.deadline}T23:59:59`).toISOString() : null,
    },
  };
}

// Drops blank rows and duplicate skills (the API rejects duplicates).
export function buildSkillRequirements(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    if (!row.skillId || seen.has(row.skillId)) continue;
    seen.add(row.skillId);
    result.push({ skill_id: row.skillId, required_level: row.level, is_required: true });
  }
  return result;
}
