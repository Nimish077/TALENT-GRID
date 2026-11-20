import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  resetDb,
  registerUser,
  login,
  bootstrapCsrf,
  cookieValue,
  uniqueEmail,
  ORIGIN,
} from "./helpers/index.js";

beforeEach(resetDb);

function replaceCookie(cookies, name, value) {
  return cookies
    .split("; ")
    .filter((cookie) => !cookie.startsWith(`${name}=`))
    .concat(`${name}=${value}`)
    .join("; ");
}

describe("CSRF bootstrap", () => {
  it("issues a signed token, sets a readable cookie, and is not cached", async () => {
    const res = await request(app).get("/api/v1/auth/csrf");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("CSRF token issued");
    expect(res.body.data.csrf_token).toMatch(/^[^.]+\.[^.]+$/);
    expect(res.headers["cache-control"]).toBe("no-store");

    const cookie = res.headers["set-cookie"].find((value) =>
      value.startsWith("csrf_token=")
    );
    expect(cookie).toBeDefined();
    expect(cookie).not.toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
    expect(cookieValue(res, "csrf_token")).toBe(res.body.data.csrf_token);

    const names = res.headers["set-cookie"].map((value) => value.split("=")[0]);
    expect(names).not.toContain("access_token");
    expect(names).not.toContain("refresh_token");
  });

  it("does not disturb an existing auth session", async () => {
    const session = await registerUser();
    const res = await request(app)
      .get("/api/v1/auth/csrf")
      .set("Cookie", session.cookies);

    expect(res.status).toBe(200);
    expect(cookieValue(res, "csrf_token")).toBe(res.body.data.csrf_token);
    expect(cookieValue(res, "csrf_token")).not.toBe(session.csrf);
    expect(res.headers["set-cookie"].join(";")).not.toContain("access_token=");
    expect(res.headers["set-cookie"].join(";")).not.toContain("refresh_token=");
  });
});

describe("CSRF tokens in auth responses", () => {
  it("register, login, and refresh return the cookie token", async () => {
    const registered = await registerUser();
    expect(registered.csrfToken).toBe(registered.csrf);
    expect(registered.res.headers["cache-control"]).toBe("no-store");

    const loggedIn = await login(registered.email, registered.password);
    expect(loggedIn.csrfToken).toBe(loggedIn.csrf);
    expect(loggedIn.res.headers["cache-control"]).toBe("no-store");

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", loggedIn.cookies)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", loggedIn.csrf);

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.csrf_token).toBe(
      cookieValue(refreshed, "csrf_token")
    );
    expect(refreshed.body.data.csrf_token).not.toBe(loggedIn.csrf);
    expect(refreshed.headers["cache-control"]).toBe("no-store");
  });
});

describe("CSRF enforcement", () => {
  it("blocks a cookie-authenticated mutation without the header", async () => {
    const { cookies } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN)
      .send({ headline: "No token" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/);
  });

  it("blocks a header that does not match the cookie", async () => {
    const { cookies } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", "forged.value")
      .send({ headline: "Mismatch" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/);
  });

  it("blocks a matching but unsigned token", async () => {
    const { cookies } = await registerUser();
    const forged = "forged.value";

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", replaceCookie(cookies, "csrf_token", forged))
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", forged)
      .send({ headline: "Unsigned" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/);
  });

  it("rejects a disallowed origin before checking the token", async () => {
    const { cookies, csrf } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("Origin", "https://evil.example.com")
      .set("X-CSRF-Token", csrf)
      .send({ headline: "Cross origin" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/origin/i);
  });

  it("requires an origin for cookie-authenticated mutations", async () => {
    const { cookies, csrf } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrf)
      .send({ headline: "No origin" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Origin header is required/);
  });

  it("allows a valid origin and token pair", async () => {
    const { cookies, csrf } = await registerUser();

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", csrf)
      .send({ headline: "Valid" });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.headline).toBe("Valid");
  });

  it("does not require CSRF for safe methods", async () => {
    const { cookies } = await registerUser();

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookies);

    expect(res.status).toBe(200);
  });

  it("exempts bearer-only requests but not bearer plus cookies", async () => {
    const { accessToken, cookies } = await registerUser();

    const bearerOnly = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ headline: "Bearer only" });
    expect(bearerOnly.status).toBe(200);

    const mixed = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", cookies)
      .set("Origin", ORIGIN)
      .send({ headline: "Mixed" });
    expect(mixed.status).toBe(403);
    expect(mixed.body.message).toMatch(/CSRF/);
  });

  it("protects logout and refresh, which are not session establishment", async () => {
    const { cookies, refresh } = await registerUser();

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN);
    expect(logout.status).toBe(403);
    expect(logout.body.message).toMatch(/CSRF/);

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN);
    expect(refreshed.status).toBe(403);
    expect(refreshed.body.message).toMatch(/CSRF/);
    expect(refresh).toBeTruthy();
  });
});

describe("login and register CSRF boundaries", () => {
  it("login ignores stale auth cookies when no token is sent", async () => {
    const session = await registerUser();

    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Cookie", session.cookies)
      .set("Origin", ORIGIN)
      .send({ email: session.email, password: session.password });

    expect(res.status).toBe(200);
    expect(res.body.data.csrf_token).toBe(cookieValue(res, "csrf_token"));
  });

  it("login works without an origin for non-browser clients with stale cookies", async () => {
    const session = await registerUser();

    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Cookie", session.cookies)
      .send({ email: session.email, password: session.password });

    expect(res.status).toBe(200);
  });

  it("register ignores stale auth and CSRF cookies", async () => {
    const session = await registerUser();
    const email = uniqueEmail("second");

    const res = await request(app)
      .post("/api/v1/auth/register")
      .set(
        "Cookie",
        replaceCookie(session.cookies, "csrf_token", "stale.value")
      )
      .set("Origin", ORIGIN)
      .send({
        email,
        password: "Password123!",
        full_name: "Second User",
        role: "candidate",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.csrf_token).toBe(cookieValue(res, "csrf_token"));
    expect(res.body.data.csrf_token).not.toBe("stale.value");
  });

  it("still rejects a disallowed origin on login", async () => {
    const session = await registerUser();

    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Cookie", session.cookies)
      .set("Origin", "https://evil.example.com")
      .send({ email: session.email, password: session.password });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/origin/i);
  });

  it("keeps the exemption exact to POST login/register", async () => {
    const session = await registerUser();

    const res = await request(app)
      .post("/api/v1/auth/login/extra")
      .set("Cookie", session.cookies)
      .set("Origin", ORIGIN)
      .send({ email: session.email, password: session.password });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/);
  });
});

describe("bootstrap flow", () => {
  it("returns a token that can be used on the next mutation", async () => {
    const session = await registerUser();
    const bootstrapped = await bootstrapCsrf(session.cookies);
    const cookies = replaceCookie(
      session.cookies,
      "csrf_token",
      bootstrapped.csrf
    );

    expect(bootstrapped.res.status).toBe(200);
    expect(bootstrapped.csrf).toBe(bootstrapped.cookie);

    const res = await request(app)
      .patch("/api/v1/candidates/me")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", bootstrapped.csrf)
      .send({ headline: "Bootstrapped" });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.headline).toBe("Bootstrapped");
  });
});
