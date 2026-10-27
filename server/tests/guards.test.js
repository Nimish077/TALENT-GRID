// The environment/config guardrails are load-time contracts; verify them by
// bootstrapping src/config/env.js in child processes with hostile configs.

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

function loadEnv(overrides) {
  return spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "import('./src/config/env.js')"],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...overrides },
      encoding: "utf8",
    }
  );
}

describe("environment guards", () => {
  it("refuses TEST_DATABASE_URI equal to DATABASE_URI", () => {
    const result = loadEnv({
      NODE_ENV: "test",
      TEST_DATABASE_URI: process.env.DATABASE_URI,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must not equal DATABASE_URI");
  });

  it("refuses a TEST_DATABASE_URI whose database name lacks 'test'", () => {
    const result = loadEnv({
      NODE_ENV: "test",
      TEST_DATABASE_URI:
        "postgresql://postgres:pw@localhost:5432/production_db",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/must contain "test"/);
  });

  it("refuses the console mailer in production", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      MAILER: "console",
      CORS_ORIGINS: "https://app.example.com",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "MAILER=console is not allowed in production"
    );
  });

  it("requires explicit CORS origins in production", () => {
    const result = loadEnv({ NODE_ENV: "production", CORS_ORIGINS: "" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "CORS_ORIGINS must be set explicitly in production"
    );
  });

  it("requires secure cookies for SameSite=None", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://app.example.com",
      MAILER: "smtp",
      COOKIE_SAMESITE: "none",
      COOKIE_SECURE: "false",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'COOKIE_SAMESITE="none" requires COOKIE_SECURE=true'
    );
  });
});
