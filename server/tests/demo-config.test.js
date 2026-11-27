import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/index.js";
import { resolveDemoLogin } from "../src/config/demo.js";

describe("resolveDemoLogin", () => {
  it("is off by default", () => {
    expect(resolveDemoLogin({})).toBe(false);
  });

  it("follows SEED_DEMO when DEMO_LOGIN is not set", () => {
    expect(resolveDemoLogin({ SEED_DEMO: "true" })).toBe(true);
    expect(resolveDemoLogin({ SEED_DEMO: "false" })).toBe(false);
    expect(resolveDemoLogin({ SEED_DEMO: "TRUE" })).toBe(false);
    expect(resolveDemoLogin({ SEED_DEMO: "true", DEMO_LOGIN: "" })).toBe(true);
  });

  it("lets DEMO_LOGIN override SEED_DEMO in both directions", () => {
    expect(resolveDemoLogin({ DEMO_LOGIN: "true" })).toBe(true);
    expect(resolveDemoLogin({ DEMO_LOGIN: "true", SEED_DEMO: "false" })).toBe(true);
    expect(resolveDemoLogin({ DEMO_LOGIN: "false", SEED_DEMO: "true" })).toBe(false);
  });

  it("treats anything but the exact string 'true' as off", () => {
    for (const value of ["1", "yes", "True", "on"]) {
      expect(resolveDemoLogin({ DEMO_LOGIN: value })).toBe(false);
    }
    expect(resolveDemoLogin({ DEMO_LOGIN: " true " })).toBe(true); // surrounding spaces are ignored
  });
});

describe("GET /api/v1/config", () => {
  it("is public, uncached and reports the demo-login switch", async () => {
    const res = await request(app).get("/api/v1/config");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toEqual({ success: true, message: "OK", data: { demo_login: false } }); // off in the test env
  });
});
