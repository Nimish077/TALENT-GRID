// Assessment scoring.
//
// Score -> level thresholds (Beginner < 50, Intermediate 50-79, Advanced >= 80).
// An attempt passes when its score reaches the pass mark AND its level reaches
// every skill's target_level; the skill is then verified at the level actually
// achieved (never below the target). Passing
// is the ONLY code path that writes verified_* fields on candidate_skills —
// candidates can never verify themselves.

import { env } from "../config/env.js";
import { ApiError } from "../errors/apiError.js";

export const LEVEL_RANK = Object.freeze({
  beginner: 1,
  intermediate: 2,
  advanced: 3,
});

// Harder questions count for more, so a high score needs advanced answers.
export const DIFFICULTY_WEIGHT = Object.freeze({
  beginner: 1,
  intermediate: 2,
  advanced: 3,
});

// rows: [{ difficulty, is_correct }] -> 0..100 (two decimals)
export function weightedScore(rows) {
  let earned = 0;
  let total = 0;
  for (const row of rows) {
    const weight = DIFFICULTY_WEIGHT[row.difficulty] ?? 1;
    total += weight;
    if (row.is_correct) earned += weight;
  }
  return total === 0 ? 0 : Math.round((earned / total) * 10000) / 100;
}

export function levelFromScore(score) {
  const numeric = Number(score);
  if (numeric < 50) return "beginner";
  if (numeric < 80) return "intermediate";
  return "advanced";
}

export async function evaluateAttempt(prisma, attemptId, score) {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: { assessment: { include: { skills: true } } },
    });

    if (!attempt) throw new ApiError(404, "Attempt not found");
    if (attempt.result_status !== "pending") {
      throw new ApiError(409, "Attempt has already been evaluated");
    }
    if (!attempt.submitted_at) {
      throw new ApiError(
        409,
        "Attempt must be submitted before it can be evaluated"
      );
    }
    if (attempt.assessment.skills.length === 0) {
      throw new ApiError(409, "Assessment has no skills configured");
    }

    const level = levelFromScore(score);
    const achievedRank = LEVEL_RANK[level];
    // The pass mark closes a loophole: without it a score of 0 still counted
    // as "beginner" and would verify a beginner-target skill.
    const allPassed =
      Number(score) >= env.assessmentPassMark &&
      attempt.assessment.skills.every(
        (assessmentSkill) =>
          achievedRank >= LEVEL_RANK[assessmentSkill.target_level]
      );

    if (allPassed) {
      for (const assessmentSkill of attempt.assessment.skills) {
        const existing = await tx.candidateSkill.findUnique({
          where: {
            candidate_profile_id_skill_id: {
              candidate_profile_id: attempt.candidate_profile_id,
              skill_id: assessmentSkill.skill_id,
            },
          },
        });

        if (!existing) {
          await tx.candidateSkill.create({
            data: {
              candidate_profile_id: attempt.candidate_profile_id,
              skill_id: assessmentSkill.skill_id,
              declared_level: level,
              verification_status: "verified",
              verified_level: level,
              verified_at: new Date(),
            },
          });
          continue;
        }

        const upgrade =
          !existing.verified_level ||
          LEVEL_RANK[existing.verified_level] < achievedRank;

        await tx.candidateSkill.update({
          where: { id: existing.id },
          data: {
            verification_status: "verified",
            verified_level: upgrade ? level : existing.verified_level,
            verified_at: new Date(),
          },
        });
      }
    }

    return tx.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        score,
        level,
        result_status: allPassed ? "passed" : "failed",
        evaluated_at: new Date(),
      },
    });
  });
}
