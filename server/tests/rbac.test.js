import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  prisma,
  resetDb,
  registerUser,
  makeAdmin,
  bearer,
  ORIGIN,
} from "./helpers/index.js";

beforeEach(resetDb);

async function setupVerifiedEmployer() {
  const employer = await registerUser({
    role: "employer",
    extra: { organization: { name: "Acme Corp" } },
  });
  const organization = await prisma.organization.findFirst({
    where: { users: { some: { user_id: employer.user.id } } },
  });
  const admin = await makeAdmin();
  const verify = await bearer(
    request(app).post(`/api/v1/admin/organizations/${organization.id}/verify`),
    admin.accessToken
  );
  expect(verify.status).toBe(200);
  return { employer, organization, admin };
}

describe("tenant guards for unverified organizations", () => {
  it("blocks the pending owner until a platform admin verifies the organization", async () => {
    const employer = await registerUser({
      role: "employer",
      extra: { organization: { name: "Pending Inc" } },
    });
    const organization = await prisma.organization.findFirst();
    expect(organization.status).toBe("pending");

    const blocked = await bearer(
      request(app).get(`/api/v1/organizations/${organization.id}`),
      employer.accessToken
    );
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(
      /access to this organization|not active/i
    );

    const blockedJob = await bearer(
      request(app).post(`/api/v1/organizations/${organization.id}/jobs`),
      employer.accessToken
    ).send({ title: "Should fail" });
    expect(blockedJob.status).toBe(403);

    const admin = await makeAdmin();
    await bearer(
      request(app).post(
        `/api/v1/admin/organizations/${organization.id}/verify`
      ),
      admin.accessToken
    );

    const allowed = await bearer(
      request(app).get(`/api/v1/organizations/${organization.id}`),
      employer.accessToken
    );
    expect(allowed.status).toBe(200);

    const membership = await prisma.organizationUser.findFirst();
    expect(membership.status).toBe("active");
  });

  it("returns 409 when verifying twice", async () => {
    const { organization, admin } = await setupVerifiedEmployer();
    const again = await bearer(
      request(app).post(
        `/api/v1/admin/organizations/${organization.id}/verify`
      ),
      admin.accessToken
    );
    expect(again.status).toBe(409);
  });

  it("blocks suspended organizations for active members", async () => {
    const { employer, organization, admin } = await setupVerifiedEmployer();

    await bearer(
      request(app).post(
        `/api/v1/admin/organizations/${organization.id}/suspend`
      ),
      admin.accessToken
    );
    const res = await bearer(
      request(app).get(`/api/v1/organizations/${organization.id}`),
      employer.accessToken
    );
    expect(res.status).toBe(403);
  });
});

describe("cross-tenant isolation", () => {
  it("non-members cannot read or mutate another organization", async () => {
    const { organization } = await setupVerifiedEmployer();
    const outsider = await registerUser({
      role: "employer",
      extra: { organization: { name: "Outsider LLC" } },
    });
    const candidate = await registerUser();

    const viaOutsider = await bearer(
      request(app).get(`/api/v1/organizations/${organization.id}`),
      outsider.accessToken
    );
    expect(viaOutsider.status).toBe(403);

    const viaCandidate = await bearer(
      request(app).patch(`/api/v1/organizations/${organization.id}`),
      candidate.accessToken
    ).send({ name: "Hijacked" });
    expect(viaCandidate.status).toBe(403);
  });

  it("members of one organization cannot manage another organization's jobs", async () => {
    const { organization } = await setupVerifiedEmployer();
    const other = await setupVerifiedEmployer();

    const job = await bearer(
      request(app).post(`/api/v1/organizations/${other.organization.id}/jobs`),
      other.employer.accessToken
    ).send({ title: "Other job" });
    expect(job.status).toBe(201);

    const res = await bearer(
      request(app).patch(`/api/v1/jobs/${job.body.data.job.id}`),
      (
        await registerUser({
          role: "employer",
          extra: { organization: { name: "Third Co" } },
        })
      ).accessToken
    ).send({ title: "Hijack" });
    expect(res.status).toBe(403);
    expect(organization.id).not.toBe(other.organization.id);
  });
});

describe("platform admin surface", () => {
  it("is closed to non-admins and anonymous callers", async () => {
    const candidate = await registerUser();

    const anonymous = await request(app).get("/api/v1/admin/users");
    expect(anonymous.status).toBe(401);

    const nonAdmin = await bearer(
      request(app).get("/api/v1/admin/users"),
      candidate.accessToken
    );
    expect(nonAdmin.status).toBe(403);
  });

  it("suspending a user revokes their sessions and blocks future logins", async () => {
    const target = await registerUser();
    const admin = await makeAdmin();

    await bearer(
      request(app).patch(`/api/v1/admin/users/${target.user.id}/status`),
      admin.accessToken
    ).send({ status: "suspended" });

    const active = await prisma.session.count({
      where: { user_id: target.user.id, revoked_at: null },
    });
    expect(active).toBe(0);

    const loginAttempt = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: target.email, password: target.password })
      .set("Origin", ORIGIN);
    expect(loginAttempt.status).toBe(403);
  });

  it("admins cannot change their own status", async () => {
    const admin = await makeAdmin();
    const res = await bearer(
      request(app).patch(`/api/v1/admin/users/${admin.user.id}/status`),
      admin.accessToken
    ).send({ status: "suspended" });
    expect(res.status).toBe(400);
  });
});

describe("cookie and bearer authorization parity on tenant routes", () => {
  it("returns the same payload for both transports", async () => {
    const { employer, organization } = await setupVerifiedEmployer();

    const viaBearer = await bearer(
      request(app).get(`/api/v1/organizations/${organization.id}`),
      employer.accessToken
    );
    const viaCookie = await request(app)
      .get(`/api/v1/organizations/${organization.id}`)
      .set("Cookie", employer.cookies);

    expect(viaBearer.status).toBe(200);
    expect(viaCookie.status).toBe(200);
    expect(viaBearer.body.data).toEqual(viaCookie.body.data);
  });
});
