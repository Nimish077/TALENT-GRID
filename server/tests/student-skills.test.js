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

async function setup() {
  const institute = await registerUser({
    role: "institute",
    extra: { institution: { name: "National Tech", code: "NT-1" } },
  });
  const institution = await prisma.institution.findUnique({ where: { code: "NT-1" } });
  const admin = await makeAdmin();
  await bearer(
    request(app).post(`/api/v1/admin/institutions/${institution.id}/verify`),
    admin.accessToken
  ).send({});

  const js = await prisma.skill.create({ data: { name: "JavaScript" } });
  const sql = await prisma.skill.create({ data: { name: "SQL" } });
  const py = await prisma.skill.create({ data: { name: "Python" } });

  let counter = 0;
  // A student; `skills` = [[skill, verified_level | null]] gives them a linked candidate account.
  async function student(name, skills, { linked = true, status = "active" } = {}) {
    counter += 1;
    let userId = null;
    if (linked) {
      const user = await registerUser();
      userId = user.user.id;
      const profile = await prisma.candidateProfile.findUnique({ where: { user_id: userId } });
      for (const [skill, level] of skills) {
        await prisma.candidateSkill.create({
          data: {
            candidate_profile_id: profile.id,
            skill_id: skill.id,
            declared_level: level ?? "beginner",
            verification_status: level ? "verified" : "unverified",
            verified_level: level,
            verified_at: level ? new Date() : null,
          },
        });
      }
    }
    return prisma.institutionMembership.create({
      data: {
        institution_id: institution.id,
        enrollment_id: `E${counter}`,
        full_name: name,
        membership_status: status,
        verification_status: "verified",
        user_id: userId,
      },
    });
  }

  return { institute, institution, admin, js, sql, py, student };
}

const list = (ctx, who = ctx.institute) =>
  bearer(
    request(app).get(`/api/v1/institutions/${ctx.institution.id}/memberships?limit=50`),
    who.accessToken
  );

const summary = (ctx, who = ctx.institute) =>
  bearer(
    request(app).get(`/api/v1/institutions/${ctx.institution.id}/skills-summary`),
    who.accessToken
  );

describe("student verified skills in the roster", () => {
  it("shows each linked student's verified skills and leaves unlinked students empty", async () => {
    const ctx = await setup();
    await ctx.student("Asha", [[ctx.js, "advanced"], [ctx.sql, "intermediate"], [ctx.py, null]]);
    await ctx.student("Ben", [], { linked: false });

    const res = await list(ctx);
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.data.items.map((i) => [i.full_name, i.skills]));

    expect(byName.Asha.verified_count).toBe(2);
    expect(byName.Asha.verified).toEqual([
      { name: "JavaScript", level: "advanced" },
      { name: "SQL", level: "intermediate" },
    ]);
    expect(byName.Asha.profile_id).toBeTruthy();
    expect(byName.Ben).toEqual({ profile_id: null, verified_count: 0, verified: [] });
  });

  it("does not count claimed (unverified) skills", async () => {
    const ctx = await setup();
    await ctx.student("Claimer", [[ctx.js, null], [ctx.sql, null]]);
    const [item] = (await list(ctx)).body.data.items;
    expect(item.skills.verified_count).toBe(0);
    expect(item.skills.profile_id).toBeTruthy();
  });
});

describe("GET /institutions/:id/skills-summary", () => {
  it("summarises linked, verified and job-ready students and the top skills", async () => {
    const ctx = await setup();
    await ctx.student("Ready 1", [[ctx.js, "advanced"], [ctx.sql, "intermediate"]]);
    await ctx.student("Ready 2", [[ctx.js, "beginner"], [ctx.py, "intermediate"]]);
    await ctx.student("Developing", [[ctx.js, "intermediate"]]);
    await ctx.student("Not started", [[ctx.sql, null]]);
    await ctx.student("Not linked", [], { linked: false });
    await ctx.student("Left the institute", [[ctx.js, "advanced"], [ctx.sql, "advanced"]], { status: "inactive" });

    const res = await summary(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      students: 5, // inactive student excluded
      linked: 4,
      with_verified: 3,
      job_ready: 2,
      top_skills: [
        { name: "JavaScript", verified_students: 3 },
        { name: "Python", verified_students: 1 },
        { name: "SQL", verified_students: 1 },
      ],
    });
  });

  it("is limited to the institution's owners and admins", async () => {
    const ctx = await setup();
    const candidate = await registerUser();
    const employer = await registerUser({ role: "employer", extra: { organization: { name: "Acme" } } });
    const otherInstitute = await registerUser({
      role: "institute",
      extra: { institution: { name: "Other College", code: "OC-1" } },
    });

    expect((await request(app).get(`/api/v1/institutions/${ctx.institution.id}/skills-summary`)).status).toBe(401);
    expect((await summary(ctx, candidate)).status).toBe(403);
    expect((await summary(ctx, employer)).status).toBe(403);
    expect((await summary(ctx, otherInstitute)).status).toBeGreaterThanOrEqual(403);
  });

  it("returns zeros for an institution with no students", async () => {
    const ctx = await setup();
    const res = await summary(ctx);
    expect(res.body.data).toEqual({ students: 0, linked: 0, with_verified: 0, job_ready: 0, top_skills: [] });
  });
});
