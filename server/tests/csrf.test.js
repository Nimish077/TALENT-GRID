import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  resetDb,
  registerUser,
  bootstrapCsrf,
  cookieValue,
  uniqueEmail,
  ORIGIN,
} from "./helpers/index.js";
import { isValidCsrfToken } from "../src/utils/tokens.js";

beforeEach(resetDb);

function setCookies(res) {
  return res.headers["set-cookie"] ?? [];
}

function csrfCookie(res) {
  return setCookies(res).find((cookie) => cookie.startsWith("csrf_token="));
}

function withCsrfCookie(cookies, token) {
  return cookies
    .split("; ")
    .map((part) =>
      part.startsWith("csrf_token=") ? `csrf_token=${token}` : part
    )
    .join("; ");
}

describe("GET /api/v1/auth/csrf", () => {
  it("issues a signed token and a readable cookie with the same value", async () => {
    const res = await request(app).get("/api/v1/auth/csrf");

    expect(res.status).toBe(200);
    const token = res.body.data.csrf_token;
    expect(typeof token).toBe("string");
    expect(isValidCsrfToken(token)).toBe(true);
    expect(cookieValue(res, "csrf_token")).toBe(token);

    const cookie = csrfCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).not.toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
  });

  it("does not create or clear authentication cookies and returns no user data", async () => {
    const { cookies } = await registerUser();

    const res = await request(app)
      .get("/api/v1/auth/csrf")
      .set("Cookie", cookies);

    expect(res.status).toBe(200);
    const raw = setCookies(res).join(";");
    expect(raw).not.toContain("access_token=");
    expect(raw).not.toContain("refresh_token=");
    expect(res.body.data.user).toBeUndefined();
    expect(res.body.data.tokens).toBeUndefined();
  });

  it("works without authentication", async () => {
    const res = await request(app).get("/api/v1/auth/csrf");
    expect(res.status).toBe(200);
    expect(res.body.data.csrf_token).toBeTruthy();
  });
});

describe("csrf_token in authentication responses", () => {
  it("registration returns the token and sets the matching cookie", async () => {
    const { res, csrfToken } = await registerUser();

    expect(csrfToken).toBeTruthy();
    expect(csrfToken).toBe(cookieValue(res, "csrf_token"));
    expect(isValidCsrfToken(csrfToken)).toBe(true);
  });

  it("login returns the token and sets the matching cookie", async () => {
    const { email, password } = await registerUser();

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password })
      .set("Origin", ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.data.csrf_token).toBe(cookieValue(res, "csrf_token"));
    expect(res.body.data.tokens.access_token).toBeTruthy();
    expect(res.body.data.tokens.refresh_token).toBeUndefined();
  });

  it("refresh returns a new token and sets the matching rotated cookie", async () => {
    const { refresh, csrf } = await registerUser();

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${refresh}; csrf_token=${csrf}`)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", csrf);

    expect(res.status).toBe(200);
    const next = res.body.data.csrf_token;
    expect(next).toBeTruthy();
    expect(next).not.toBe(csrf);
    expect(next).toBe(cookieValue(res, "csrf_token"));
    expect(res.body.data.tokens.refresh_token).toBeUndefined();
  });
});

describe("CSRF enforcement", () => {
  it("accepts a freshly bootstrapped token for a cookie-authenticated mutation", async () => {
    const { cookies } = await registerUser();
    const boot = await bootstrapCsrf(cookies);
    const token = boot.csrf;

    expect(token).toBeTruthy();
    expect(boot.cookie).toBe(token);

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", withCsrfCookie(cookies, token))
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", token)
      .send({ headline: "Bootstrap flow" });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.headline).toBe("Bootstrap flow");
  });

  it("rejects a token whose signature does not verify", async () => {
    const { cookies, csrf } = await registerUser();
    const forged = `${csrf.split(".")[0]}.forged-signature`;

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", withCsrfCookie(cookies, forged))
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", forged)
      .send({ headline: "Forged" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/);
  });

  it("does not let Bearer authentication bypass CSRF when auth cookies are present", async () => {
    const { cookies, accessToken } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Origin", ORIGIN)
      .send({ headline: "Bearer plus cookie" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/);
  });

  it("requires CSRF on refresh when cookies are used", async () => {
    const { refresh, csrf } = await registerUser();

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${refresh}; csrf_token=${csrf}`)
      .set("Origin", ORIGIN);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/);
  });

  it("does not require CSRF for safe methods", async () => {
    const { cookies } = await registerUser();

    const get = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookies);
    expect(get.status).toBe(200);

    const head = await request(app)
      .head("/api/v1/auth/me")
      .set("Cookie", cookies);
    expect(head.status).toBe(200);

    const options = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", ORIGIN)
      .set("Access-Control-Request-Method", "POST");
    expect(options.status).toBe(204);
  });

  it("rejects a disallowed Origin on login", async () => {
    const { email, password } = await registerUser();

    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "https://evil.example.com")
      .send({ email, password });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/origin/i);
  });

  it("rejects a disallowed Origin on registration", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", "https://evil.example.com")
      .send({
        email: uniqueEmail("evil-origin"),
        password: "Password123!",
        full_name: "Evil Origin",
        role: "candidate",
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/origin/i);
  });

  it("keeps Origin-less non-browser login working", async () => {
    const { email, password } = await registerUser();

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    expect(res.status).toBe(200);
  });

  it("allows login with a csrf cookie but no CSRF header", async () => {
    const { email, password } = await registerUser();
    const boot = await bootstrapCsrf();
    const token = boot.csrf;

    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Cookie", `csrf_token=${token}`)
      .set("Origin", ORIGIN)
      .send({ email, password });

    expect(res.status).toBe(200);
    const next = res.body.data.csrf_token;
    expect(next).toBeTruthy();
    expect(next).not.toBe(token);
    expect(next).toBe(cookieValue(res, "csrf_token"));
  });
});
