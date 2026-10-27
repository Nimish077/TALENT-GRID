import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  prisma,
  resetDb,
  registerUser,
  login,
  makeAdmin,
  uniqueEmail,
  ORIGIN,
} from "./helpers/index.js";

beforeEach(resetDb);

describe("registration & login", () => {
  it("registers a candidate, creates the profile, and sets the cookie trio", async () => {
    const { user, res } = await registerUser();

    expect(user.role).toBe("candidate");
    const profile = await prisma.candidateProfile.findUnique({
      where: { user_id: user.id },
    });
    expect(profile).not.toBeNull();

    const cookies = res.headers["set-cookie"];
    const access = cookies.find((c) => c.startsWith("access_token="));
    const refresh = cookies.find((c) => c.startsWith("refresh_token="));
    const csrf = cookies.find((c) => c.startsWith("csrf_token="));

    expect(access).toContain("HttpOnly");
    expect(access).toContain("Path=/api/v1");
    expect(refresh).toContain("HttpOnly");
    expect(refresh).toContain("Path=/api/v1/auth");
    expect(csrf).not.toContain("HttpOnly");
    expect(csrf).toContain("Path=/");
  });

  it("rejects duplicate emails with 409", async () => {
    const { email } = await registerUser();
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password: "Password123!",
        full_name: "Copy",
        role: "candidate",
      })
      .set("Origin", ORIGIN);
    expect(res.status).toBe(409);
  });

  it("registration of employer/institute creates a pending entity and owner", async () => {
    const employer = await registerUser({
      role: "employer",
      extra: { organization: { name: "Acme Corp" } },
    });
    const org = await prisma.organization.findFirst({
      where: { name: "Acme Corp" },
      include: { users: true },
    });
    expect(org.status).toBe("pending");
    expect(org.users[0]).toMatchObject({ role: "owner", status: "pending" });

    const institute = await registerUser({
      role: "institute",
      extra: { institution: { name: "Test Institute", code: "TI-1" } },
    });
    const institution = await prisma.institution.findUnique({
      where: { code: "TI-1" },
    });
    expect(institution.status).toBe("pending");
    expect(employer.user.role).toBe("employer");
    expect(institute.user.role).toBe("institute");
  });

  it("does not allow admin self-registration", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: uniqueEmail("sneaky"),
        password: "Password123!",
        full_name: "Sneaky",
        role: "admin",
      })
      .set("Origin", ORIGIN);
    expect(res.status).toBe(422);
  });

  it("rejects wrong credentials (401) and suspended accounts (403)", async () => {
    const { email, user } = await registerUser();

    const wrong = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "WrongPassword1!" })
      .set("Origin", ORIGIN);
    expect(wrong.status).toBe(401);

    await prisma.user.update({
      where: { id: user.id },
      data: { status: "suspended" },
    });
    const suspended = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "Password123!" })
      .set("Origin", ORIGIN);
    expect(suspended.status).toBe(403);
  });
});

describe("session endpoints", () => {
  it("GET /me works with cookie and with bearer, identically", async () => {
    const { user, cookies, accessToken } = await registerUser();

    const viaCookie = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookies);
    const viaBearer = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(viaCookie.status).toBe(200);
    expect(viaBearer.status).toBe(200);
    expect(viaCookie.body.data.user).toEqual(viaBearer.body.data.user);
    expect(viaCookie.body.data.user.id).toBe(user.id);
  });

  it("logout revokes the refresh session and clears cookies; idempotent", async () => {
    const { cookies, csrf, refresh } = await registerUser();
    expect(refresh).toBeTruthy();

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(200);
    const cleared = res.headers["set-cookie"].join(";");
    expect(cleared).toContain("access_token=;");
    expect(cleared).toContain("refresh_token=;");

    const session = await prisma.session.findFirst({
      where: { revoke_reason: "logout" },
    });
    expect(session).not.toBeNull();

    const again = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", ORIGIN);
    expect(again.status).toBe(200);
  });
});

describe("CSRF protection", () => {
  it("blocks cookie-authenticated mutations without the double-submit token", async () => {
    const { cookies } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN)
      .send({ headline: "Hello" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/);
  });

  it("blocks a mismatched CSRF header even with a valid cookie", async () => {
    const { cookies } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", "forged.value")
      .send({ headline: "Hello" });
    expect(res.status).toBe(403);
  });

  it("rejects disallowed origins for cookie-authenticated mutations", async () => {
    const { cookies, csrf } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("Origin", "https://evil.example.com")
      .set("X-CSRF-Token", csrf)
      .send({ headline: "Hello" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/origin/i);
  });

  it("allows the change with a valid origin + csrf pair", async () => {
    const { cookies, csrf } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", csrf)
      .send({ headline: "Frontend Engineer" });
    expect(res.status).toBe(200);
    expect(res.body.data.profile.headline).toBe("Frontend Engineer");
  });

  it("exempts bearer-authenticated mutations from CSRF", async () => {
    const { accessToken } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ headline: "Bearer OK" });
    expect(res.status).toBe(200);
    expect(res.body.data.profile.headline).toBe("Bearer OK");
  });

  it("requires an Origin header once cookies are involved", async () => {
    const { cookies, csrf } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrf)
      .send({ headline: "No origin" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Origin header is required/);
  });

  it("keeps unauthenticated login/register exempt (no cookies yet)", async () => {
    const { email } = await registerUser();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "Password123!" })
      .set("Origin", ORIGIN);
    expect(res.status).toBe(200);
  });
});

describe("suspended accounts", () => {
  it("blocks an existing access token after suspension", async () => {
    const { user, accessToken } = await registerUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "suspended" },
    });

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe("admin bootstrap", () => {
  it("permits an admin created out-of-band to log in", async () => {
    const { accessToken } = await makeAdmin();
    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it("login works repeatedly and each login creates a separate session family", async () => {
    const { email, password } = await makeAdmin();
    const first = await login(email, password);
    const second = await login(email, password);
    expect(first.refresh).not.toBe(second.refresh);
    const sessions = await prisma.session.findMany();
    // makeAdmin's bootstrap login + the two logins above.
    expect(sessions).toHaveLength(3);
    expect(new Set(sessions.map((s) => s.family_id)).size).toBe(3);
  });
});
