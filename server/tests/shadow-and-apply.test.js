import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, prisma, resetDb, registerUser, makeAdmin, bearer } from "./helpers/index.js";

beforeEach(resetDb);

async function instituteWithRoster(rows) {
  const institute = await registerUser({
    role: "institute",
    extra: { institution: { name: "National Tech", code: "NT-9" } },
  });
  const institution = await prisma.institution.findUnique({ where: { code: "NT-9" } });
  const admin = await makeAdmin();
  await bearer(request(app).post(`/api/v1/admin/institutions/${institution.id}/verify`), admin.accessToken);
  const res = await bearer(
    request(app).post(`/api/v1/institutions/${institution.id}/imports`),
    institute.accessToken
  ).send({ file_name: "roster.csv", rows });
  expect(res.status).toBe(201);
  return { institute, institution };
}

describe("claiming an imported (shadow) profile", () => {
  const rows = [
    { enrollment_id: "E2301", full_name: "Asha Rao", institutional_email: "asha@nt.edu", personal_email: "asha.rao@gmail.com" },
    { enrollment_id: "E2302", full_name: "Ravi Kumar", institutional_email: "ravi@nt.edu" },
  ];

  it("lets a student with the same email see and claim their profile", async () => {
    const { institution } = await instituteWithRoster(rows);
    const student = await registerUser({ email: "asha.rao@gmail.com" });

    const matches = await bearer(request(app).get("/api/v1/membership-claims/matches"), student.accessToken);
    expect(matches.status).toBe(200);
    expect(matches.body.data.matches).toHaveLength(1);
    const match = matches.body.data.matches[0];
    expect(match.institution.id).toBe(institution.id);
    // The enrollment id is never revealed, only a masked hint.
    expect(JSON.stringify(match)).not.toContain("E2301");
    expect(match.enrollment_hint).toBe("E2**1");

    const wrong = await bearer(request(app).post("/api/v1/membership-claims/claim"), student.accessToken).send({
      membership_id: match.id,
      enrollment_id: "E9999",
    });
    expect(wrong.status).toBe(403);

    const ok = await bearer(request(app).post("/api/v1/membership-claims/claim"), student.accessToken).send({
      membership_id: match.id,
      enrollment_id: "e2301",
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.membership.verification_status).toBe("verified");
    expect(ok.body.data.membership.verification_source).toBe("login_email_match");

    const after = await bearer(request(app).get("/api/v1/membership-claims/matches"), student.accessToken);
    expect(after.body.data.matches).toHaveLength(0);
  });

  it("does not let a different account claim someone else's profile", async () => {
    await instituteWithRoster(rows);
    const stranger = await registerUser({ email: "stranger@example.com" });
    const membership = await prisma.institutionMembership.findFirst({ where: { enrollment_id: "E2302" } });

    const matches = await bearer(request(app).get("/api/v1/membership-claims/matches"), stranger.accessToken);
    expect(matches.body.data.matches).toHaveLength(0);

    const claim = await bearer(request(app).post("/api/v1/membership-claims/claim"), stranger.accessToken).send({
      membership_id: membership.id,
      enrollment_id: "E2302",
    });
    expect(claim.status).toBe(404);
    const still = await prisma.institutionMembership.findUnique({ where: { id: membership.id } });
    expect(still.user_id).toBeNull();
  });
});

describe("applying to a job that requires skills", () => {
  async function jobRequiring(skillName) {
    const employer = await registerUser({ role: "employer", extra: { organization: { name: "Acme Corp" } } });
    const organization = await prisma.organization.findFirst();
    const admin = await makeAdmin();
    await bearer(request(app).post(`/api/v1/admin/organizations/${organization.id}/verify`), admin.accessToken);
    const created = await bearer(
      request(app).post(`/api/v1/organizations/${organization.id}/jobs`),
      employer.accessToken
    ).send({ title: "Web Developer", description: "Build pages" });
    const job = created.body.data.job;
    const skill = await prisma.skill.create({ data: { name: skillName } });
    await prisma.jobSkill.create({ data: { job_id: job.id, skill_id: skill.id, required_level: "beginner", is_required: true } });
    await bearer(request(app).post(`/api/v1/jobs/${job.id}/publish`), employer.accessToken);
    return { job, skill };
  }

  it("blocks a candidate who lacks the required skill and names it", async () => {
    const { job } = await jobRequiring("HTML");
    const candidate = await registerUser();
    const res = await bearer(request(app).post(`/api/v1/jobs/${job.id}/applications`), candidate.accessToken).send({});
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/HTML/);
  });

  it("allows the application once the skill is on the profile", async () => {
    const { job, skill } = await jobRequiring("HTML");
    const candidate = await registerUser();
    const added = await bearer(request(app).post("/api/v1/candidates/me/skills"), candidate.accessToken).send({
      skill_id: skill.id,
      declared_level: "beginner",
    });
    expect(added.status).toBe(201);
    const res = await bearer(request(app).post(`/api/v1/jobs/${job.id}/applications`), candidate.accessToken).send({});
    expect(res.status).toBe(201);
  });

  it("reports whether each skill has a test to verify it", async () => {
    const withTest = await prisma.skill.create({ data: { name: "SQL" } });
    await prisma.skill.create({ data: { name: "Obscure" } });
    const assessment = await prisma.assessment.create({
      data: {
        title: "SQL Skill Assessment",
        assessment_type: "skill",
        duration_minutes: 15,
        status: "active",
        skills: { create: [{ skill_id: withTest.id, target_level: "beginner" }] },
        questions: {
          create: [
            {
              difficulty: "beginner",
              prompt: "Q?",
              options: { create: [{ text: "a", is_correct: true, position: 0 }, { text: "b", is_correct: false, position: 1 }] },
            },
          ],
        },
      },
    });
    const candidate = await registerUser();
    const res = await bearer(request(app).get("/api/v1/skills?limit=50"), candidate.accessToken);
    const byName = Object.fromEntries(res.body.data.items.map((s) => [s.name, s.assessment_id]));
    expect(byName.SQL).toBe(assessment.id);
    expect(byName.Obscure).toBeNull();
  });
});
