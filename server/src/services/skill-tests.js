// Which skills can actually be verified?
//
// A skill is testable when an active skill assessment covers it and that
// assessment has usable questions. Everything else can still be declared, but
// there is nothing to verify it with, and the UI says so instead of sending the
// user to an empty assessments page.

import { prisma } from "../lib/prisma.js";

// Map of skill id -> assessment id, for the given skills.
export async function testableSkills(skillIds) {
  const ids = [...new Set(skillIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const links = await prisma.assessmentSkill.findMany({
    where: {
      skill_id: { in: ids },
      assessment: { status: "active", assessment_type: "skill" },
    },
    select: {
      skill_id: true,
      assessment_id: true,
      assessment: {
        select: {
          questions: {
            where: { status: "active" },
            select: { id: true, options: { select: { is_correct: true } } },
          },
        },
      },
    },
  });

  const result = new Map();
  for (const link of links) {
    const usable = link.assessment.questions.some(
      (q) => q.options.length >= 2 && q.options.filter((o) => o.is_correct).length === 1
    );
    if (usable && !result.has(link.skill_id)) result.set(link.skill_id, link.assessment_id);
  }
  return result;
}

// Adds `assessment_id` (or null) to each row, reading the skill id with `pick`.
export async function withAssessment(rows, pick = (row) => row.id) {
  const map = await testableSkills(rows.map(pick));
  return rows.map((row) => ({ ...row, assessment_id: map.get(pick(row)) ?? null }));
}
