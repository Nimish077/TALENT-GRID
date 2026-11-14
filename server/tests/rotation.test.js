import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  prisma,
  resetDb,
  registerUser,
  cookieValue,
  ORIGIN,
} from "./helpers/index.js";

beforeEach(resetDb);

function refreshWith(refreshValue, csrf) {
  return request(app)
    .post("/api/v1/auth/refresh")
    .set("Cookie", `refresh_token=${refreshValue}; csrf_token=${csrf}`)
    .set("Origin", ORIGIN)
    .set("X-CSRF-Token", csrf);
}

async function activeSessionCount() {
  return prisma.session.count({
    where: { revoked_at: null, expires_at: { gt: new Date() } },
  });
}

describe("refresh rotation", () => {
  it("rotates the refresh token and revokes the old session", async () => {
    const { refresh, csrf } = await registerUser();

    const res = await refreshWith(refresh, csrf);
    expect(res.status).toBe(200);
    const refresh2 = cookieValue(res, "refresh_token");
    expect(refresh2).toBeTruthy();
    expect(refresh2).not.toBe(refresh);

    const oldSession = await prisma.session.findFirst({
      where: { revoke_reason: "rotated" },
    });
    expect(oldSession).not.toBeNull();
    expect(await activeSessionCount()).toBe(1);

    const res2 = await refreshWith(refresh2, cookieValue(res, "csrf_token"));
    expect(res2.status).toBe(200);
    expect(await activeSessionCount()).toBe(1);
  });

  it("answers a just-rotated token within the grace window with a retry 401 and keeps cookies", async () => {
    const { refresh, csrf } = await registerUser();
    const first = await refreshWith(refresh, csrf);
    expect(first.status).toBe(200);

    const replay = await refreshWith(refresh, csrf);
    expect(replay.status).toBe(401);
    expect(replay.body.message).toMatch(/retry/i);
    expect(replay.headers["set-cookie"]).toBeUndefined();
  });

  it("survives concurrent refreshes: exactly one winner, one retry, one live session", async () => {
    const { refresh, csrf } = await registerUser();

    const [a, b] = await Promise.all([
      refreshWith(refresh, csrf),
      refreshWith(refresh, csrf),
    ]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([200, 401]);

    const loser = a.status === 401 ? a : b;
    expect(loser.body.message).toMatch(/retry/i);
    expect(await activeSessionCount()).toBe(1);
  });

  it("kills the whole family when a rotated token is reused beyond the grace window", async () => {
    const { refresh, csrf } = await registerUser();
    const first = await refreshWith(refresh, csrf);
    const refresh2 = cookieValue(first, "refresh_token");
    const csrf2 = cookieValue(first, "csrf_token");

    // Age the rotation beyond the grace window.
    await prisma.session.updateMany({
      where: { revoke_reason: "rotated" },
      data: { revoked_at: new Date(Date.now() - 120_000) },
    });

    const replay = await refreshWith(refresh, csrf);
    expect(replay.status).toBe(401);
    expect(replay.body.message).toMatch(/reuse/i);
    expect(replay.headers["set-cookie"].join(";")).toContain("refresh_token=;");

    const latest = await refreshWith(refresh2, csrf2);
    expect(latest.status).toBe(401);
    expect(await activeSessionCount()).toBe(0);

    const killed = await prisma.session.count({
      where: { revoke_reason: "reuse_detected" },
    });
    expect(killed).toBeGreaterThan(0);
  });

  it("rejects refresh after logout", async () => {
    const { cookies, csrf, refresh } = await registerUser();
    await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookies)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", csrf);

    const res = await refreshWith(refresh, csrf);
    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"].join(";")).toContain("refresh_token=;");
  });

  it("rejects and clears cookies for an expired session", async () => {
    const { refresh, csrf } = await registerUser();
    // expires_at must stay after created_at (DB check), so age both.
    await prisma.session.updateMany({
      data: {
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expires_at: new Date(Date.now() - 1000),
      },
    });

    const res = await refreshWith(refresh, csrf);
    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"].join(";")).toContain("refresh_token=;");
  });

  it("rejects a fabricated refresh token", async () => {
    const { csrf } = await registerUser();
    const res = await refreshWith("totally-made-up-token", csrf);
    expect(res.status).toBe(401);
  });
});
