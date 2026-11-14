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

const ENGINE_TOKEN = process.env.ASSESSMENT_ENGINE_TOKEN;

async function setupAssessment({ targetLevel = "intermediate" } = {}) {
  const admin = await makeAdmin();
  const skill = await prisma.skill.create({
    data: { name: "JavaScript", category: "Language" },
  });
  const create = await bearer(
    request(app).post("/api/v1/assessments"),
    admin.accessToken
  ).send({
    title: "JavaScript Fundamentals",
    assessment_type: "skill",
    difficulty: "intermediate",
    duration_minutes: 45,
    skills: [{ skill_id: skill.id, target_level: targetLevel }],
  });
  expect(create.status).toBe(201);
  const assessment = create.body.data.assessment;

  const activate = await bearer(
    request(app).patch(`/api/v1/assessments/${assessment.id}`),
    admin.accessToken
  ).send({ status: "active" });
  expect(activate.status).toBe(200);

  const candidate = await registerUser();
  const profile = await prisma.candidateProfile.findUnique({
    where: { user_id: candidate.user.id },
  });
  return { admin, skill, assessment, candidate, profile };
}

function startAttempt(assessmentId, candidate) {
  return bearer(
    request(app).post(`/api/v1/assessments/${assessmentId}/attempts`),
    candidate.accessToken
  ).send({});
}

function submitAttempt(attemptId, candidate) {
  return bearer(
    request(app).post(`/api/v1/assessments/attempts/${attemptId}/submit`),
    candidate.accessToken
  ).send({});
}

function evaluate(attemptId, score, token, expectStatus = 200) {
  return bearer(
    request(app).post(`/api/v1/assessments/attempts/${attemptId}/evaluate`),
    token
  )
    .send({ score })
    .expect((res) => {
      if (res.status !== expectStatus) {
        throw new Error(
          `expected ${expectStatus}, got ${res.status}: ${JSON.stringify(res.body)}`
        );
      }
    });
}

describe("assessment attempt lifecycle", () => {
  it("creates attempts, enforces one open attempt, submit+pass verification", async () => {
    const { assessment, candidate, profile, skill } = await setupAssessment();

    const start = await startAttempt(assessment.id, candidate);
    expect(start.status).toBe(201);
    expect(start.body.data.attempt.attempt_number).toBe(1);
    expect(start.body.data.attempt.result_status).toBe("pending");

    const second = await startAttempt(assessment.id, candidate);
    expect(second.status).toBe(409);

    const attemptId = start.body.data.attempt.id;

    const evaluateBeforeSubmit = await evaluate(
      attemptId,
      90,
      ENGINE_TOKEN,
      409
    );
    expect(evaluateBeforeSubmit.status).toBe(409);

    const submit = await submitAttempt(attemptId, candidate);
    expect(submit.status).toBe(200);
    expect(submit.body.data.attempt.submitted_at).toBeTruthy();

    const evaluated = await evaluate(attemptId, 85, ENGINE_TOKEN);
    expect(evaluated.body.data.attempt.result_status).toBe("passed");
    expect(evaluated.body.data.attempt.level).toBe("advanced");

    const candidateSkill = await prisma.candidateSkill.findUnique({
      where: {
        candidate_profile_id_skill_id: {
          candidate_profile_id: profile.id,
          skill_id: skill.id,
        },
      },
    });
    expect(candidateSkill.verification_status).toBe("verified");
    // verified_level is the assessment's target level (the bar that was met).
    expect(candidateSkill.verified_level).toBe("intermediate");
    expect(candidateSkill.verified_at).not.toBeNull();

    const duplicate = await evaluate(attemptId, 90, ENGINE_TOKEN, 409);
    expect(duplicate.status).toBe(409);
  });

  it("fails the attempt below target level and never verifies skills", async () => {
    const { assessment, candidate, profile, skill } = await setupAssessment();
    const start = await startAttempt(assessment.id, candidate);
    const attemptId = start.body.data.attempt.id;
    await submitAttempt(attemptId, candidate);

    const evaluated = await evaluate(attemptId, 90, ENGINE_TOKEN);

    expect(evaluated.body.data.attempt.result_status).toBe("passed");
    expect(evaluated.body.data.attempt.level).toBe("advanced");

    // New attempt, scoring below the intermediate target.
    const start2 = await startAttempt(assessment.id, candidate);
    const attempt2 = start2.body.data.attempt.id;
    expect(start2.body.data.attempt.attempt_number).toBe(2);
    await submitAttempt(attempt2, candidate);

    const failed = await evaluate(attempt2, 40, ENGINE_TOKEN);
    expect(failed.body.data.attempt.result_status).toBe("failed");
    expect(failed.body.data.attempt.level).toBe("beginner");

    const candidateSkill = await prisma.candidateSkill.findUnique({
      where: {
        candidate_profile_id_skill_id: {
          candidate_profile_id: profile.id,
          skill_id: skill.id,
        },
      },
    });
    // The earlier pass stands; the failed attempt did not downgrade it.
    expect(candidateSkill.verified_level).toBe("intermediate");
  });

  it("abandon frees the open slot for a fresh attempt", async () => {
    const { assessment, candidate } = await setupAssessment();
    const start = await startAttempt(assessment.id, candidate);
    const attemptId = start.body.data.attempt.id;

    const abandon = await bearer(
      request(app).post(`/api/v1/assessments/attempts/${attemptId}/abandon`),
      candidate.accessToken
    ).send({});
    expect(abandon.status).toBe(200);
    expect(abandon.body.data.attempt.result_status).toBe("abandoned");

    const restart = await startAttempt(assessment.id, candidate);
    expect(restart.status).toBe(201);
    expect(restart.body.data.attempt.attempt_number).toBe(2);
  });

  it("evaluation requires the engine token or a platform admin", async () => {
    const { assessment, candidate, admin } = await setupAssessment();
    const start = await startAttempt(assessment.id, candidate);
    const attemptId = start.body.data.attempt.id;
    await submitAttempt(attemptId, candidate);

    const asCandidate = await bearer(
      request(app).post(`/api/v1/assessments/attempts/${attemptId}/evaluate`),
      candidate.accessToken
    ).send({ score: 90 });
    expect(asCandidate.status).toBe(403);

    const anonymous = await request(app)
      .post(`/api/v1/assessments/attempts/${attemptId}/evaluate`)
      .send({ score: 90 });
    expect(anonymous.status).toBe(401);

    const wrongEngine = await request(app)
      .post(`/api/v1/assessments/attempts/${attemptId}/evaluate`)
      .set("Authorization", "Bearer not-the-engine-token")
      .send({ score: 90 });
    expect(wrongEngine.status).toBe(401);

    const asAdmin = await evaluate(attemptId, 50, admin.accessToken);
    expect(asAdmin.body.data.attempt.result_status).toBe("passed");
    expect(asAdmin.body.data.attempt.level).toBe("intermediate");
  });

  it("score bounds are validated", async () => {
    const { assessment, candidate } = await setupAssessment();
    const start = await startAttempt(assessment.id, candidate);
    const attemptId = start.body.data.attempt.id;
    await submitAttempt(attemptId, candidate);

    const res = await bearer(
      request(app).post(`/api/v1/assessments/attempts/${attemptId}/evaluate`),
      ENGINE_TOKEN
    ).send({ score: 140 });
    expect(res.status).toBe(422);
  });
});

describe("candidate skill self-management", () => {
  it("lets candidates declare levels but never verify their own skills", async () => {
    const { candidate, profile, skill } = await setupAssessment();

    const add = await bearer(
      request(app).post("/api/v1/candidates/me/skills"),
      candidate.accessToken
    ).send({ skill_id: skill.id, declared_level: "beginner" });
    expect(add.status).toBe(201);
    expect(add.body.data.item.verification_status).toBe("unverified");

    const sneak = await bearer(
      request(app).patch(
        `/api/v1/candidates/me/skills/${add.body.data.item.id}`
      ),
      candidate.accessToken
    ).send({
      declared_level: "advanced",
      verified_level: "advanced",
      verification_status: "verified",
    });
    expect(sneak.status).toBe(200);

    const row = await prisma.candidateSkill.findUnique({
      where: { id: add.body.data.item.id },
    });
    expect(row.declared_level).toBe("advanced");
    expect(row.verified_level).toBeNull();
    expect(row.verification_status).toBe("unverified");
    expect(row.candidate_profile_id).toBe(profile.id);

    const duplicate = await bearer(
      request(app).post("/api/v1/candidates/me/skills"),
      candidate.accessToken
    ).send({ skill_id: skill.id, declared_level: "beginner" });
    expect(duplicate.status).toBe(409);
  });
});

describe("assessment visibility", () => {
  it("candidates only see and start active assessments", async () => {
    const admin = await makeAdmin();
    const skill = await prisma.skill.create({ data: { name: "SQL" } });
    const create = await bearer(
      request(app).post("/api/v1/assessments"),
      admin.accessToken
    ).send({
      title: "Draft Assessment",
      assessment_type: "skill",
      duration_minutes: 30,
      skills: [{ skill_id: skill.id, target_level: "beginner" }],
    });
    const draft = create.body.data.assessment;

    const candidate = await registerUser();

    const list = await bearer(
      request(app).get("/api/v1/assessments"),
      candidate.accessToken
    );
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(0);

    const direct = await bearer(
      request(app).get(`/api/v1/assessments/${draft.id}`),
      candidate.accessToken
    );
    expect(direct.status).toBe(404);

    const start = await startAttempt(draft.id, candidate);
    expect(start.status).toBe(404);

    const attempts = await bearer(
      request(app).get("/api/v1/assessments/attempts/mine"),
      candidate.accessToken
    );
    expect(attempts.status).toBe(200);
    expect(attempts.body.data.attempts).toHaveLength(0);
  });
});
