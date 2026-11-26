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
import { parseRequirements, scoreCandidate } from "../src/modules/talent/talent.routes.js";

beforeEach(resetDb);

async function setup() {
  const admin = await makeAdmin();
  const employer = await registerUser({
    role: "employer",
    extra: { organization: { name: "Acme Corp" } },
  });
  const organization = await prisma.organization.findFirst();

  const js = await prisma.skill.create({ data: { name: "JavaScript" } });
  const sql = await prisma.skill.create({ data: { name: "SQL" } });
  const react = await prisma.skill.create({ data: { name: "React" } });

  async function candidate(name, skills, profile = {}) {
    const user = await registerUser();
    await prisma.user.update({ where: { id: user.user.id }, data: { full_name: name } });
    const p = await prisma.candidateProfile.update({
      where: { user_id: user.user.id },
      data: { headline: `${name} headline`, location: "Bengaluru", ...profile },
    });
    for (const [skill, declared, verified] of skills) {
      await prisma.candidateSkill.create({
        data: {
          candidate_profile_id: p.id,
          skill_id: skill.id,
          declared_level: declared,
          verification_status: verified ? "verified" : "unverified",
          verified_level: verified ?? null,
          verified_at: verified ? new Date() : null,
        },
      });
    }
    return { user, profile: p };
  }

  return { admin, employer, organization, js, sql, react, candidate };
}

async function verifyOrg(ctx) {
  await bearer(
    request(app).post(`/api/v1/admin/organizations/${ctx.organization.id}/verify`),
    ctx.admin.accessToken
  ).send({});
}

const search = (ctx, query = "") =>
  bearer(request(app).get(`/api/v1/talent${query}`), ctx.employer.accessToken);

describe("requirement parsing and scoring", () => {
  const id1 = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const id2 = "4fa85f64-5717-4562-b3fc-2c963f66afa6";

  it("parses skillId:level lists, defaults to beginner and drops duplicates", () => {
    expect(parseRequirements(`${id1}:advanced,${id2},${id1}:beginner`)).toEqual([
      { skill_id: id1, level: "advanced" },
      { skill_id: id2, level: "beginner" },
    ]);
    expect(parseRequirements("")).toEqual([]);
    expect(() => parseRequirements("not-a-uuid:advanced")).toThrow();
    expect(() => parseRequirements(`${id1}:godlike`)).toThrow();
  });

  it("only counts verified skills at or above the required level", () => {
    const rows = [
      { skill_id: id1, verification_status: "verified", verified_level: "intermediate" },
      { skill_id: id2, verification_status: "unverified", verified_level: null },
    ];
    const result = scoreCandidate(rows, [
      { skill_id: id1, level: "intermediate" },
      { skill_id: id2, level: "beginner" },
    ]);
    expect(result.percent).toBe(50);
    expect(result.gaps).toEqual([{ skill_id: id2, level: "beginner", status: "claimed" }]);

    const tooLow = scoreCandidate(rows, [{ skill_id: id1, level: "advanced" }]);
    expect(tooLow.percent).toBe(0);
  });
});

describe("GET /talent", () => {
  it("is employer/admin only and needs a verified organization", async () => {
    const ctx = await setup();
    const candidate = await registerUser();

    expect((await request(app).get("/api/v1/talent")).status).toBe(401);
    expect(
      (await bearer(request(app).get("/api/v1/talent"), candidate.accessToken)).status
    ).toBe(403);
    // Organization still pending.
    expect((await search(ctx)).status).toBe(403);

    await verifyOrg(ctx);
    expect((await search(ctx)).status).toBe(200);
  });

  it("ranks candidates by the share of requirements they have VERIFIED", async () => {
    const ctx = await setup();
    await verifyOrg(ctx);
    await ctx.candidate("Full Match", [[ctx.js, "advanced", "advanced"], [ctx.sql, "intermediate", "intermediate"]]);
    await ctx.candidate("Half Match", [[ctx.js, "intermediate", "intermediate"], [ctx.sql, "advanced", null]]);
    await ctx.candidate("Claims Only", [[ctx.js, "advanced", null], [ctx.sql, "advanced", null]]);
    await ctx.candidate("Wrong Skills", [[ctx.react, "advanced", "advanced"]]);

    const res = await search(ctx, `?skills=${ctx.js.id}:intermediate,${ctx.sql.id}:intermediate`);
    expect(res.status).toBe(200);
    const items = res.body.data.items;

    expect(items.map((i) => [i.full_name, i.match_percent])).toEqual([
      ["Full Match", 100],
      ["Half Match", 50],
    ]);
    expect(items[1].gaps).toEqual([
      expect.objectContaining({ name: "SQL", status: "claimed", required_level: "intermediate" }),
    ]);
    expect(items[0].matched_skills.map((m) => m.name).sort()).toEqual(["JavaScript", "SQL"]);
    expect(res.body.data.requirements.map((r) => r.name)).toEqual(["JavaScript", "SQL"]);
  });

  it("filters by minimum match, location and free text", async () => {
    const ctx = await setup();
    await verifyOrg(ctx);
    await ctx.candidate("Asha", [[ctx.js, "advanced", "advanced"], [ctx.sql, "advanced", "advanced"]], { location: "Mumbai" });
    await ctx.candidate("Ben", [[ctx.js, "advanced", "advanced"]], { location: "Bengaluru" });
    const base = `skills=${ctx.js.id}:beginner,${ctx.sql.id}:beginner`;

    expect((await search(ctx, `?${base}&min_match=100`)).body.data.items.map((i) => i.full_name)).toEqual(["Asha"]);
    expect((await search(ctx, `?${base}&location=bengal`)).body.data.items.map((i) => i.full_name)).toEqual(["Ben"]);
    expect((await search(ctx, `?${base}&search=asha`)).body.data.items.map((i) => i.full_name)).toEqual(["Asha"]);
  });

  it("hides private profiles and candidates who are not open to work", async () => {
    const ctx = await setup();
    await verifyOrg(ctx);
    await ctx.candidate("Visible", [[ctx.js, "advanced", "advanced"]]);
    await ctx.candidate("Private", [[ctx.js, "advanced", "advanced"]], { profile_visibility: "private" });
    await ctx.candidate("Busy", [[ctx.js, "advanced", "advanced"]], { open_to_work: false });

    const res = await search(ctx, `?skills=${ctx.js.id}:beginner`);
    expect(res.body.data.items.map((i) => i.full_name)).toEqual(["Visible"]);
  });

  it("lists everyone (no match percentage) when no skills are requested, and paginates", async () => {
    const ctx = await setup();
    await verifyOrg(ctx);
    for (const name of ["A", "B", "C"]) await ctx.candidate(name, [[ctx.js, "advanced", "advanced"]]);

    const res = await search(ctx, "?limit=2");
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0].match_percent).toBeNull();
    expect(res.body.data.pagination.total).toBe(3);
  });

  it("rejects malformed skill filters", async () => {
    const ctx = await setup();
    await verifyOrg(ctx);
    expect((await search(ctx, "?skills=banana")).status).toBe(422);
  });
});

describe("GET /talent/:id", () => {
  it("returns the profile with the assessment evidence behind the badges", async () => {
    const ctx = await setup();
    await verifyOrg(ctx);
    const { profile } = await ctx.candidate("Evidence", [[ctx.js, "advanced", "advanced"]]);
    const assessment = await prisma.assessment.create({
      data: {
        title: "JavaScript Skill Test",
        assessment_type: "skill",
        duration_minutes: 15,
        status: "active",
        skills: { create: [{ skill_id: ctx.js.id, target_level: "beginner" }] },
      },
    });
    await prisma.assessmentAttempt.create({
      data: {
        assessment_id: assessment.id,
        candidate_profile_id: profile.id,
        attempt_number: 1,
        result_status: "passed",
        score: 91.5,
        level: "advanced",
        question_count: 12,
        correct_count: 11,
        submitted_at: new Date(),
        evaluated_at: new Date(),
      },
    });

    const res = await bearer(
      request(app).get(`/api/v1/talent/${profile.id}`),
      ctx.employer.accessToken
    );
    expect(res.status).toBe(200);
    expect(res.body.data.profile.skills[0].skill.name).toBe("JavaScript");
    expect(res.body.data.assessment_evidence).toEqual([
      expect.objectContaining({
        assessment_title: "JavaScript Skill Test",
        skills: ["JavaScript"],
        result_status: "passed",
        level: "advanced",
        correct_count: 11,
        question_count: 12,
      }),
    ]);
  });

  it("404s for private profiles", async () => {
    const ctx = await setup();
    await verifyOrg(ctx);
    const { profile } = await ctx.candidate("Hidden", [], { profile_visibility: "private" });
    const res = await bearer(
      request(app).get(`/api/v1/talent/${profile.id}`),
      ctx.employer.accessToken
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /admin/stats", () => {
  it("is admin only and summarises the platform", async () => {
    const ctx = await setup();
    const candidate = await registerUser();

    expect((await bearer(request(app).get("/api/v1/admin/stats"), candidate.accessToken)).status).toBe(403);
    const res = await bearer(request(app).get("/api/v1/admin/stats"), ctx.admin.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data.users.employers).toBe(1);
    expect(res.body.data.users.candidates).toBe(1);
    expect(res.body.data.organizations.pending).toBe(1);
    expect(res.body.data.verified_skills).toBe(0);
  });
});
