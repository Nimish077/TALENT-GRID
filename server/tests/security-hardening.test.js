import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, prisma, resetDb, registerUser, makeAdmin, bearer } from "./helpers/index.js";

beforeEach(resetDb);

// ---------------------------------------------------------------- helpers --

async function orgSetup() {
  const owner = await registerUser({ role: "employer", extra: { organization: { name: "Acme" } } });
  const org = await prisma.organization.findFirst();
  const admin = await makeAdmin();
  await bearer(request(app).post(`/api/v1/admin/organizations/${org.id}/verify`), admin.accessToken).send({});
  return { owner, org, admin };
}

async function instSetup() {
  const owner = await registerUser({ role: "institute", extra: { institution: { name: "Tech", code: "T-1" } } });
  const inst = await prisma.institution.findUnique({ where: { code: "T-1" } });
  const admin = await makeAdmin();
  await bearer(request(app).post(`/api/v1/admin/institutions/${inst.id}/verify`), admin.accessToken).send({});
  return { owner, inst, admin };
}

const newEmployer = (name) => registerUser({ role: "employer", extra: { organization: { name } } });
const newInstitute = (name, code) => registerUser({ role: "institute", extra: { institution: { name, code } } });

// ------------------------------------------------- SEC-01: owner escalation --

describe("only an owner can assign the owner role (organizations)", () => {
  async function withAdminMember() {
    const ctx = await orgSetup();
    const second = await newEmployer("Second");
    const added = await bearer(request(app).post(`/api/v1/organizations/${ctx.org.id}/members`), ctx.owner.accessToken)
      .send({ email: second.email, role: "admin" });
    expect(added.status).toBe(201);
    return { ...ctx, orgAdmin: second };
  }

  it("rejects an admin adding an owner, but still lets them add plain members and admins", async () => {
    const ctx = await withAdminMember();
    const victim = await newEmployer("Victim");
    const asOwner = await bearer(request(app).post(`/api/v1/organizations/${ctx.org.id}/members`), ctx.orgAdmin.accessToken)
      .send({ email: victim.email, role: "owner" });
    expect(asOwner.status).toBe(403);
    expect(asOwner.body.message).toMatch(/only an owner/i);
    expect(await prisma.organizationUser.count({ where: { user_id: victim.user.id } })).toBe(1); // only their own org

    const member = await newEmployer("Member");
    const asMember = await bearer(request(app).post(`/api/v1/organizations/${ctx.org.id}/members`), ctx.orgAdmin.accessToken)
      .send({ email: member.email, role: "member" });
    expect(asMember.status).toBe(201);
  });

  it("rejects an admin promoting someone to owner", async () => {
    const ctx = await withAdminMember();
    const member = await newEmployer("Member");
    const added = await bearer(request(app).post(`/api/v1/organizations/${ctx.org.id}/members`), ctx.orgAdmin.accessToken)
      .send({ email: member.email, role: "member" });
    const promote = await bearer(
      request(app).patch(`/api/v1/organizations/${ctx.org.id}/members/${added.body.data.member.user.id}`),
      ctx.orgAdmin.accessToken
    ).send({ role: "owner" });
    expect(promote.status).toBe(403);
  });

  it("still lets an owner add and promote owners", async () => {
    const ctx = await orgSetup();
    const second = await newEmployer("Second");
    const add = await bearer(request(app).post(`/api/v1/organizations/${ctx.org.id}/members`), ctx.owner.accessToken)
      .send({ email: second.email, role: "owner" });
    expect(add.status).toBe(201);
    expect(add.body.data.member.role).toBe("owner");

    const third = await newEmployer("Third");
    const added = await bearer(request(app).post(`/api/v1/organizations/${ctx.org.id}/members`), ctx.owner.accessToken)
      .send({ email: third.email });
    const promote = await bearer(
      request(app).patch(`/api/v1/organizations/${ctx.org.id}/members/${added.body.data.member.user.id}`),
      ctx.owner.accessToken
    ).send({ role: "owner" });
    expect(promote.status).toBe(200);
  });
});

describe("only an owner can assign the owner role (institutions)", () => {
  it("rejects an institution admin adding or promoting an owner", async () => {
    const ctx = await instSetup();
    const staff = await newInstitute("Staff College", "S-1");
    const added = await bearer(request(app).post(`/api/v1/institutions/${ctx.inst.id}/members`), ctx.owner.accessToken)
      .send({ email: staff.email, role: "admin" });
    expect(added.status).toBe(201);

    const victim = await newInstitute("Victim College", "V-1");
    const asOwner = await bearer(request(app).post(`/api/v1/institutions/${ctx.inst.id}/members`), staff.accessToken)
      .send({ email: victim.email, role: "owner" });
    expect(asOwner.status).toBe(403);

    const plain = await newInstitute("Plain College", "P-1");
    const asMember = await bearer(request(app).post(`/api/v1/institutions/${ctx.inst.id}/members`), staff.accessToken)
      .send({ email: plain.email, role: "member" });
    expect(asMember.status).toBe(201);
    const promote = await bearer(
      request(app).patch(`/api/v1/institutions/${ctx.inst.id}/members/${asMember.body.data.member.user.id}`),
      staff.accessToken
    ).send({ role: "owner" });
    expect(promote.status).toBe(403);
  });

  it("still lets an owner add an owner", async () => {
    const ctx = await instSetup();
    const second = await newInstitute("Second College", "S-2");
    const add = await bearer(request(app).post(`/api/v1/institutions/${ctx.inst.id}/members`), ctx.owner.accessToken)
      .send({ email: second.email, role: "owner" });
    expect(add.status).toBe(201);
  });
});

// ------------------------------------------------------------ API-01 / 02 --

describe("job detail for anonymous visitors", () => {
  it("returns 404 (not 500) for a non-public job, and 200 once it is published", async () => {
    const { owner, org } = await orgSetup();
    const created = await bearer(request(app).post(`/api/v1/organizations/${org.id}/jobs`), owner.accessToken).send({ title: "Draft role" });
    const id = created.body.data.job.id;

    expect((await request(app).get(`/api/v1/jobs/${id}`)).status).toBe(404);

    const other = await registerUser();
    expect((await bearer(request(app).get(`/api/v1/jobs/${id}`), other.accessToken)).status).toBe(403);
    expect((await bearer(request(app).get(`/api/v1/jobs/${id}`), owner.accessToken)).status).toBe(200);

    await bearer(request(app).post(`/api/v1/jobs/${id}/publish`), owner.accessToken).send({});
    expect((await request(app).get(`/api/v1/jobs/${id}`)).status).toBe(200);
  });
});

describe("salary bounds", () => {
  it("rejects values the database cannot store with 422, and accepts the largest valid one", async () => {
    const { owner, org } = await orgSetup();
    const post = (body) => bearer(request(app).post(`/api/v1/organizations/${org.id}/jobs`), owner.accessToken).send(body);

    const tooBig = await post({ title: "Rich role", salary_min: 1, salary_max: 99999999999999 });
    expect(tooBig.status).toBe(422);
    const tooBigMin = await post({ title: "Rich role", salary_min: 99999999999999 });
    expect(tooBigMin.status).toBe(422);

    const ok = await post({ title: "Top role", salary_min: 1, salary_max: 9999999999 });
    expect(ok.status).toBe(201);
  });
});

// ------------------------------------------------------------------ SEC-04 --

describe("invitations", () => {
  it("only go out for published jobs", async () => {
    const { owner, org } = await orgSetup();
    const created = await bearer(request(app).post(`/api/v1/organizations/${org.id}/jobs`), owner.accessToken).send({ title: "Role" });
    const id = created.body.data.job.id;
    const candidate = await registerUser();
    const profile = await prisma.candidateProfile.findUnique({ where: { user_id: candidate.user.id } });
    const invite = () => bearer(request(app).post(`/api/v1/jobs/${id}/invitations`), owner.accessToken).send({ candidate_profile_id: profile.id });

    expect((await invite()).status).toBe(409); // draft

    await bearer(request(app).post(`/api/v1/jobs/${id}/publish`), owner.accessToken).send({});
    expect((await invite()).status).toBe(201); // published

    await bearer(request(app).post(`/api/v1/jobs/${id}/close`), owner.accessToken).send({});
    const closedJobInvite = await bearer(request(app).post(`/api/v1/jobs/${id}/invitations`), owner.accessToken).send({ candidate_profile_id: profile.id });
    expect(closedJobInvite.status).toBe(409); // closed
  });
});

// ------------------------------------------------------------ SEC-02 / 03 --

describe("placement drive access", () => {
  async function driveSetup() {
    const ctx = await instSetup();
    const candidate = await registerUser();
    const membership = (verification_status, membership_status = "active") =>
      prisma.institutionMembership.create({
        data: {
          institution_id: ctx.inst.id,
          enrollment_id: `E${Math.random().toString(36).slice(2, 7)}`,
          full_name: "Student",
          membership_status,
          verification_status,
          user_id: candidate.user.id,
        },
      });
    const drive = (status, title = "Drive") =>
      prisma.placementDrive.create({
        data: {
          institution_id: ctx.inst.id,
          created_by_user_id: ctx.owner.user.id,
          title,
          status,
          application_open_at: new Date(Date.now() - 86400000),
          application_deadline: new Date(Date.now() + 86400000),
        },
      });
    const detail = (id, who) => bearer(request(app).get(`/api/v1/drives/${id}`), who.accessToken);
    const apply = (id, who) => bearer(request(app).post(`/api/v1/drives/${id}/applications`), who.accessToken).send({});
    return { ...ctx, candidate, membership, drive, detail, apply };
  }

  it("blocks unverified (or inactive) members from viewing and applying", async () => {
    const ctx = await driveSetup();
    const open = await ctx.drive("open");
    const row = await ctx.membership("unverified");

    expect((await ctx.detail(open.id, ctx.candidate)).status).toBe(404);
    const blockedApply = await ctx.apply(open.id, ctx.candidate);
    expect(blockedApply.status).toBe(403);
    expect(blockedApply.body.message).toMatch(/verified/i);

    await prisma.institutionMembership.update({ where: { id: row.id }, data: { verification_status: "verified", membership_status: "inactive" } });
    expect((await ctx.detail(open.id, ctx.candidate)).status).toBe(404);
    expect((await ctx.apply(open.id, ctx.candidate)).status).toBe(403);
  });

  it("lets a verified, active member view and apply", async () => {
    const ctx = await driveSetup();
    const open = await ctx.drive("open");
    await ctx.membership("verified");
    expect((await ctx.detail(open.id, ctx.candidate)).status).toBe(200);
    expect((await ctx.apply(open.id, ctx.candidate)).status).toBe(201);
  });

  it("hides draft and cancelled drives from students but not from institute staff", async () => {
    const ctx = await driveSetup();
    await ctx.membership("verified");
    const draft = await ctx.drive("draft", "Secret draft");
    const cancelled = await ctx.drive("cancelled", "Cancelled");
    const closed = await ctx.drive("closed", "Closed");

    expect((await ctx.detail(draft.id, ctx.candidate)).status).toBe(404);
    expect((await ctx.detail(cancelled.id, ctx.candidate)).status).toBe(404);
    expect((await ctx.detail(closed.id, ctx.candidate)).status).toBe(200);
    expect((await ctx.detail(draft.id, ctx.owner)).status).toBe(200);
  });

  it("only shows students the published jobs linked to a drive", async () => {
    const ctx = await driveSetup();
    await ctx.membership("verified");
    const open = await ctx.drive("open");

    const employer = await newEmployer("Hiring Co");
    const org = await prisma.organization.findFirst({ where: { name: "Hiring Co" } });
    const mkJob = (title, status) =>
      prisma.job.create({ data: { organization_id: org.id, created_by_user_id: employer.user.id, title, status } });
    const published = await mkJob("Published job", "published");
    const draftJob = await mkJob("Draft job", "draft");
    await prisma.placementDriveJob.createMany({
      data: [published, draftJob].map((job) => ({ placement_drive_id: open.id, job_id: job.id })),
    });

    const titles = (res) => res.body.data.drive.jobs.map((link) => link.job.title).sort();
    expect(titles(await ctx.detail(open.id, ctx.candidate))).toEqual(["Published job"]);
    expect(titles(await ctx.detail(open.id, ctx.owner))).toEqual(["Draft job", "Published job"]);
  });
});
