import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  prisma,
  resetDb,
  registerUser,
  makeAdmin,
  bearer,
} from "./helpers/index.js";

beforeEach(resetDb);

const TIERS = ["beginner", "intermediate", "advanced"];

// 8 questions per tier, 4 options each, option 0 is always the correct one.
async function setup({ targetLevel = "beginner" } = {}) {
  const admin = await makeAdmin();
  const skill = await prisma.skill.create({
    data: { name: "JavaScript", category: "Language" },
  });
  const created = await bearer(
    request(app).post("/api/v1/assessments"),
    admin.accessToken
  ).send({
    title: "JavaScript Skill Test",
    assessment_type: "skill",
    difficulty: "intermediate",
    duration_minutes: 15,
    skills: [{ skill_id: skill.id, target_level: targetLevel }],
  });
  const assessment = created.body.data.assessment;
  await bearer(
    request(app).patch(`/api/v1/assessments/${assessment.id}`),
    admin.accessToken
  ).send({ status: "active" });

  for (const tier of TIERS) {
    for (let n = 0; n < 8; n += 1) {
      await prisma.assessmentQuestion.create({
        data: {
          assessment_id: assessment.id,
          difficulty: tier,
          prompt: `${tier} question ${n}`,
          explanation: "Because.",
          options: {
            create: [0, 1, 2, 3].map((i) => ({
              text: i === 0 ? "RIGHT" : `wrong ${i}`,
              is_correct: i === 0,
              position: i,
            })),
          },
        },
      });
    }
  }

  const candidate = await registerUser();
  const profile = await prisma.candidateProfile.findUnique({
    where: { user_id: candidate.user.id },
  });
  return { admin, skill, assessment, candidate, profile };
}

const start = (assessmentId, who) =>
  bearer(
    request(app).post(`/api/v1/assessments/${assessmentId}/attempts`),
    who.accessToken
  ).send({});

const view = (attemptId, who) =>
  bearer(
    request(app).get(`/api/v1/assessments/attempts/${attemptId}`),
    who.accessToken
  );

const submit = (attemptId, who) =>
  bearer(
    request(app).post(`/api/v1/assessments/attempts/${attemptId}/submit`),
    who.accessToken
  ).send({});

const answer = (attemptId, who, question_id, option_id) =>
  bearer(
    request(app).put(`/api/v1/assessments/attempts/${attemptId}/answer`),
    who.accessToken
  ).send({ question_id, option_id });

// Answers every question; `pick(question)` returns the option text to choose
// (RIGHT or a wrong one). Uses the review data (difficulty) only through the
// database, never from the pre-submit view.
async function answerAll(attemptId, who, shouldBeRight) {
  const { body } = await view(attemptId, who);
  const rows = await prisma.assessmentAttemptQuestion.findMany({
    where: { attempt_id: attemptId },
    include: { question: true },
  });
  const difficulty = new Map(rows.map((r) => [r.question_id, r.question.difficulty]));
  for (const q of body.data.questions) {
    const right = shouldBeRight(difficulty.get(q.id));
    const option = q.options.find((o) => (o.text === "RIGHT") === right);
    const res = await answer(attemptId, who, q.id, option.id);
    expect(res.status).toBe(200);
  }
}

describe("starting an attempt", () => {
  it("draws a balanced, shuffled set and sets a server-side deadline", async () => {
    const { assessment, candidate } = await setup();
    const res = await start(assessment.id, candidate);
    expect(res.status).toBe(201);
    const { attempt } = res.body.data;
    expect(attempt.question_count).toBe(12); // 4 per tier
    expect(new Date(attempt.expires_at).getTime() - new Date(attempt.started_at).getTime()).toBe(15 * 60000);

    const rows = await prisma.assessmentAttemptQuestion.findMany({
      where: { attempt_id: attempt.id },
      include: { question: true },
    });
    for (const tier of TIERS) {
      expect(rows.filter((r) => r.question.difficulty === tier)).toHaveLength(4);
    }
  });

  it("never exposes answer keys, difficulty or explanations before submission", async () => {
    const { assessment, candidate } = await setup();
    const { body } = await start(assessment.id, candidate);
    const res = await view(body.data.attempt.id, candidate);

    expect(res.status).toBe(200);
    expect(res.body.data.questions).toHaveLength(12);
    const text = JSON.stringify(res.body);
    for (const leaked of ["is_correct", "correct_option_id", "explanation", "difficulty"]) {
      expect(text).not.toContain(leaked);
    }
    expect(res.body.data.questions[0].options).toHaveLength(4);
    expect(res.body.data.attempt.server_time).toBeTruthy();
  });

  it("is private to the candidate who started it", async () => {
    const { assessment, candidate } = await setup();
    const other = await registerUser();
    const { body } = await start(assessment.id, candidate);
    expect((await view(body.data.attempt.id, other)).status).toBe(404);
  });
});

describe("answers", () => {
  it("saves and replaces an answer, and rejects foreign options", async () => {
    const { assessment, candidate } = await setup();
    const { body } = await start(assessment.id, candidate);
    const id = body.data.attempt.id;
    const [q1, q2] = (await view(id, candidate)).body.data.questions;

    expect((await answer(id, candidate, q1.id, q1.options[0].id)).status).toBe(200);
    expect((await answer(id, candidate, q1.id, q1.options[1].id)).status).toBe(200);
    const saved = (await view(id, candidate)).body.data.questions.find((q) => q.id === q1.id);
    expect(saved.selected_option_id).toBe(q1.options[1].id);

    expect((await answer(id, candidate, q1.id, q2.options[0].id)).status).toBe(422);
    expect((await answer(id, candidate, "3fa85f64-5717-4562-b3fc-2c963f66afa6", q1.options[0].id)).status).toBe(404);
  });

  it("counts focus losses until the attempt is submitted", async () => {
    const { assessment, candidate } = await setup();
    const { body } = await start(assessment.id, candidate);
    const id = body.data.attempt.id;
    const ping = () =>
      bearer(
        request(app).post(`/api/v1/assessments/attempts/${id}/focus-loss`),
        candidate.accessToken
      ).send({});

    expect((await ping()).body.data.focus_losses).toBe(1);
    expect((await ping()).body.data.focus_losses).toBe(2);
    await submit(id, candidate);
    expect((await ping()).body.data.focus_losses).toBe(2);
  });
});

describe("grading", () => {
  it("passes a perfect attempt at advanced, verifies the skill and reveals the review", async () => {
    const { assessment, candidate, profile, skill } = await setup();
    const { body } = await start(assessment.id, candidate);
    const id = body.data.attempt.id;
    await answerAll(id, candidate, () => true);

    const res = await submit(id, candidate);
    expect(res.status).toBe(200);
    const { attempt, questions } = res.body.data;
    expect(attempt.result_status).toBe("passed");
    expect(Number(attempt.score)).toBe(100);
    expect(attempt.level).toBe("advanced");
    expect(attempt.correct_count).toBe(12);
    expect(questions.every((q) => q.is_correct && q.correct_option_id && q.explanation)).toBe(true);

    const row = await prisma.candidateSkill.findUnique({
      where: {
        candidate_profile_id_skill_id: { candidate_profile_id: profile.id, skill_id: skill.id },
      },
    });
    expect(row.verification_status).toBe("verified");
    expect(row.verified_level).toBe("advanced");
  });

  it("does NOT verify a candidate who answers everything wrong (pass-mark fix)", async () => {
    const { assessment, candidate, profile, skill } = await setup({ targetLevel: "beginner" });
    const { body } = await start(assessment.id, candidate);
    const id = body.data.attempt.id;
    await answerAll(id, candidate, () => false);

    const { attempt } = (await submit(id, candidate)).body.data;
    expect(Number(attempt.score)).toBe(0);
    expect(attempt.result_status).toBe("failed");
    expect(
      await prisma.candidateSkill.findUnique({
        where: {
          candidate_profile_id_skill_id: { candidate_profile_id: profile.id, skill_id: skill.id },
        },
      })
    ).toBeNull();
  });

  it("weights harder questions: beginner+intermediate right earns intermediate, not advanced", async () => {
    const { assessment, candidate } = await setup();
    const { body } = await start(assessment.id, candidate);
    const id = body.data.attempt.id;
    await answerAll(id, candidate, (tier) => tier !== "advanced");

    const { attempt } = (await submit(id, candidate)).body.data;
    expect(Number(attempt.score)).toBe(50); // (4*1 + 4*2) / (4*1 + 4*2 + 4*3)
    expect(attempt.level).toBe("intermediate");
    expect(attempt.result_status).toBe("passed");
  });

  it("treats unanswered questions as wrong", async () => {
    const { assessment, candidate } = await setup();
    const { body } = await start(assessment.id, candidate);
    const { attempt } = (await submit(body.data.attempt.id, candidate)).body.data;
    expect(Number(attempt.score)).toBe(0);
    expect(attempt.result_status).toBe("failed");
  });

  it("cannot be submitted or answered twice", async () => {
    const { assessment, candidate } = await setup();
    const { body } = await start(assessment.id, candidate);
    const id = body.data.attempt.id;
    const [q] = (await view(id, candidate)).body.data.questions;
    await submit(id, candidate);

    expect((await submit(id, candidate)).status).toBe(409);
    expect((await answer(id, candidate, q.id, q.options[0].id)).status).toBe(409);
  });
});

describe("timer", () => {
  it("auto-grades an attempt that is past its deadline and frees the slot", async () => {
    const { assessment, candidate } = await setup();
    const { body } = await start(assessment.id, candidate);
    const id = body.data.attempt.id;
    await answerAll(id, candidate, () => true); // all right, saved before time ran out

    await prisma.assessmentAttempt.update({
      where: { id },
      data: { expires_at: new Date(Date.now() - 5 * 60000) },
    });

    const res = await view(id, candidate);
    expect(res.body.data.attempt.result_status).toBe("passed");
    expect(res.body.data.attempt.submitted_at).toBeTruthy();

    // Late answers are refused.
    const [q] = res.body.data.questions;
    expect((await answer(id, candidate, q.id, q.options[0].id)).status).toBe(409);
  });

  it("an expired, unanswered attempt fails and does not block a later attempt", async () => {
    const { assessment, candidate } = await setup();
    const { body } = await start(assessment.id, candidate);
    const id = body.data.attempt.id;
    await prisma.assessmentAttempt.update({
      where: { id },
      data: { expires_at: new Date(Date.now() - 5 * 60000) },
    });

    expect((await start(assessment.id, candidate)).status).toBe(409); // cooldown, not "open attempt"
    const graded = await prisma.assessmentAttempt.findUnique({ where: { id } });
    expect(graded.result_status).toBe("failed");
  });
});

describe("retakes", () => {
  it("enforces a cooldown after a finished attempt and reports when to retry", async () => {
    const { assessment, candidate } = await setup();
    const first = await start(assessment.id, candidate);
    await submit(first.body.data.attempt.id, candidate);

    const again = await start(assessment.id, candidate);
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/retake this assessment in/i);
    expect(again.body.error[0].path).toBe("retry_at");

    await prisma.assessmentAttempt.update({
      where: { id: first.body.data.attempt.id },
      data: { submitted_at: new Date(Date.now() - 60 * 60000) },
    });
    const later = await start(assessment.id, candidate);
    expect(later.status).toBe(201);
    expect(later.body.data.attempt.attempt_number).toBe(2);
  });

  it("only one open attempt at a time, and abandoning does not trigger the cooldown", async () => {
    const { assessment, candidate } = await setup();
    const first = await start(assessment.id, candidate);
    const open = await start(assessment.id, candidate);
    expect(open.status).toBe(409);
    expect(open.body.error[0].message).toBe(first.body.data.attempt.id);

    await bearer(
      request(app).post(`/api/v1/assessments/attempts/${first.body.data.attempt.id}/abandon`),
      candidate.accessToken
    ).send({});
    expect((await start(assessment.id, candidate)).status).toBe(201);
  });
});

describe("catalogue", () => {
  it("shows test length and the candidate's own status", async () => {
    const { assessment, candidate } = await setup();
    const list = async () =>
      (
        await bearer(request(app).get("/api/v1/assessments"), candidate.accessToken)
      ).body.data.items.find((a) => a.id === assessment.id);

    const before = await list();
    expect(before.question_count).toBe(12);
    expect(before.my_status.open_attempt_id).toBeNull();
    expect(before.my_status.last_result).toBeNull();

    const { body } = await start(assessment.id, candidate);
    expect((await list()).my_status.open_attempt_id).toBe(body.data.attempt.id);

    await answerAll(body.data.attempt.id, candidate, () => true);
    await submit(body.data.attempt.id, candidate);
    const after = await list();
    expect(after.my_status.last_result.result_status).toBe("passed");
    expect(after.my_status.retry_at).toBeTruthy();
    expect(after.skills[0].mine.verified_level).toBe("advanced");
  });
});
