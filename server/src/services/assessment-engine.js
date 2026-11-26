// Multiple-choice assessment engine.
//
// Trust model (why verified levels can be relied on):
//   * Answer keys never leave the server until an attempt is submitted.
//   * Each attempt draws a random, difficulty-balanced set of questions and
//     shuffles the options; the snapshot is stored so results can be audited.
//   * The deadline is enforced with server timestamps. An attempt that runs out
//     of time is graded automatically from whatever was saved.
//   * Scoring is difficulty-weighted, so a high level needs advanced answers.
//   * Retakes are rate-limited and tab/window focus losses are recorded.
//   * The only code path that verifies a skill is evaluateAttempt() in
//     scoring.js, which this module calls after grading.

import { randomInt } from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "../errors/apiError.js";
import { evaluateAttempt, weightedScore } from "./scoring.js";

export const TIERS = ["beginner", "intermediate", "advanced"];
const MAX_FOCUS_LOSSES = 100;

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A question is usable only if it has >= 2 options and exactly one correct one.
function isUsable(question) {
  return (
    question.options.length >= 2 &&
    question.options.filter((option) => option.is_correct).length === 1
  );
}

export async function activeQuestions(prisma, assessmentId) {
  const questions = await prisma.assessmentQuestion.findMany({
    where: { assessment_id: assessmentId, status: "active" },
    include: { options: true },
  });
  return questions.filter(isUsable);
}

// How many questions a test would contain for this pool.
export function testLength(questions) {
  return TIERS.reduce(
    (sum, tier) =>
      sum +
      Math.min(
        env.assessmentQuestionsPerTier,
        questions.filter((q) => q.difficulty === tier).length
      ),
    0
  );
}

export function pickQuestions(questions) {
  const picked = TIERS.flatMap((tier) =>
    shuffle(questions.filter((q) => q.difficulty === tier)).slice(
      0,
      env.assessmentQuestionsPerTier
    )
  );
  return shuffle(picked);
}

// Creates an engine-managed attempt: snapshot of questions + shuffled options.
export async function createQuestionAttempt(prisma, data, assessment, pool) {
  const picked = pickQuestions(pool);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.assessmentAttempt.create({
      data: {
        ...data,
        started_at: now,
        expires_at: new Date(now.getTime() + assessment.duration_minutes * 60000),
        question_count: picked.length,
      },
    });
    await tx.assessmentAttemptQuestion.createMany({
      data: picked.map((question, index) => ({
        attempt_id: attempt.id,
        question_id: question.id,
        position: index + 1,
        option_order: shuffle(question.options).map((option) => option.id),
      })),
    });
    return attempt;
  });
}

export function retryAt(lastFinished) {
  if (!lastFinished?.submitted_at) return null;
  const at = new Date(
    lastFinished.submitted_at.getTime() +
      env.assessmentRetakeCooldownMinutes * 60000
  );
  return at > new Date() ? at : null;
}

export async function lastFinishedAttempt(prisma, assessmentId, profileId) {
  return prisma.assessmentAttempt.findFirst({
    where: {
      assessment_id: assessmentId,
      candidate_profile_id: profileId,
      result_status: { in: ["passed", "failed"] },
      submitted_at: { not: null },
    },
    orderBy: { submitted_at: "desc" },
  });
}

// Grades an engine-managed attempt exactly once and verifies skills on a pass.
export async function gradeAttempt(prisma, attemptId, submittedAt = new Date()) {
  const claimed = await prisma.assessmentAttempt.updateMany({
    where: { id: attemptId, result_status: "pending", submitted_at: null },
    data: { submitted_at: submittedAt },
  });
  if (claimed.count === 0) return false; // already submitted / graded elsewhere

  const rows = await prisma.assessmentAttemptQuestion.findMany({
    where: { attempt_id: attemptId },
    include: { question: { include: { options: true } } },
  });

  const graded = rows.map((row) => {
    const correct = row.question.options.find((option) => option.is_correct);
    return {
      id: row.id,
      difficulty: row.question.difficulty,
      is_correct: Boolean(
        row.selected_option_id && row.selected_option_id === correct?.id
      ),
    };
  });

  await prisma.$transaction([
    ...graded.map((row) =>
      prisma.assessmentAttemptQuestion.update({
        where: { id: row.id },
        data: { is_correct: row.is_correct },
      })
    ),
    prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { correct_count: graded.filter((row) => row.is_correct).length },
    }),
  ]);

  await evaluateAttempt(prisma, attemptId, weightedScore(graded));
  return true;
}

export function isExpired(attempt, now = new Date()) {
  return Boolean(
    attempt.expires_at &&
      attempt.result_status === "pending" &&
      !attempt.submitted_at &&
      now.getTime() > attempt.expires_at.getTime() + env.assessmentSubmitGraceSeconds * 1000
  );
}

// Lazily auto-submits an attempt whose deadline has passed.
export async function finalizeIfExpired(prisma, attempt) {
  if (!isExpired(attempt)) return false;
  return gradeAttempt(prisma, attempt.id, attempt.expires_at);
}

export async function finalizeExpiredFor(prisma, profileId) {
  const open = await prisma.assessmentAttempt.findMany({
    where: {
      candidate_profile_id: profileId,
      result_status: "pending",
      submitted_at: null,
      expires_at: { not: null },
    },
  });
  for (const attempt of open) await finalizeIfExpired(prisma, attempt);
}

export async function recordAnswer(prisma, attempt, questionId, optionId) {
  if (attempt.result_status !== "pending" || attempt.submitted_at) {
    throw new ApiError(409, "This attempt has already been submitted");
  }
  if (!attempt.expires_at) {
    throw new ApiError(409, "This attempt does not accept answers");
  }
  if (await finalizeIfExpired(prisma, attempt)) {
    throw new ApiError(409, "Time is up: your attempt was submitted automatically");
  }
  const row = await prisma.assessmentAttemptQuestion.findUnique({
    where: {
      attempt_id_question_id: { attempt_id: attempt.id, question_id: questionId },
    },
  });
  if (!row) throw new ApiError(404, "Question is not part of this attempt");
  if (!row.option_order.includes(optionId)) {
    throw new ApiError(422, "Option does not belong to this question");
  }

  await prisma.assessmentAttemptQuestion.update({
    where: { id: row.id },
    data: { selected_option_id: optionId, answered_at: new Date() },
  });
}

export async function recordFocusLoss(prisma, attempt) {
  if (attempt.result_status !== "pending" || attempt.submitted_at) {
    return attempt.focus_losses;
  }
  const next = Math.min(MAX_FOCUS_LOSSES, attempt.focus_losses + 1);
  await prisma.assessmentAttempt.update({
    where: { id: attempt.id },
    data: { focus_losses: next },
  });
  return next;
}

// Candidate-facing view. The answer key and per-question difficulty are only
// revealed after the attempt has been submitted.
export async function attemptView(prisma, attemptId) {
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      assessment: {
        select: {
          id: true,
          title: true,
          duration_minutes: true,
          skills: { include: { skill: { select: { id: true, name: true } } } },
        },
      },
      questions: {
        orderBy: { position: "asc" },
        include: { question: { include: { options: true } } },
      },
    },
  });
  if (!attempt) throw new ApiError(404, "Attempt not found");

  const reveal = Boolean(attempt.submitted_at) || attempt.result_status !== "pending";
  const { questions, ...rest } = attempt;

  return {
    attempt: { ...rest, server_time: new Date() },
    questions: questions.map((row) => {
      const byId = new Map(row.question.options.map((option) => [option.id, option]));
      const view = {
        id: row.question_id,
        position: row.position,
        prompt: row.question.prompt,
        options: row.option_order.map((id) => ({ id, text: byId.get(id)?.text })),
        selected_option_id: row.selected_option_id,
      };
      if (reveal) {
        view.correct_option_id = row.question.options.find((option) => option.is_correct)?.id ?? null;
        view.is_correct = row.is_correct;
        view.difficulty = row.question.difficulty;
        view.explanation = row.question.explanation;
      }
      return view;
    }),
  };
}
