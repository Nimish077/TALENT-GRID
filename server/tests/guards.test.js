// The environment/config guardrails are load-time contracts; verify them by
// bootstrapping src/config/env.js in child processes with hostile configs.

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const JWT_SECRET = "j".repeat(64);
const CSRF_SECRET = "c".repeat(64);

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
      JWT_SECRET,
      CSRF_SECRET,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "MAILER=console is not allowed in production"
    );
  });

  it("requires explicit CORS origins in production", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      CORS_ORIGINS: "",
      JWT_SECRET,
      CSRF_SECRET,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "CORS_ORIGINS must be set explicitly in production"
    );
  });

  it("normalizes CORS origins to bare origins", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import('./src/config/env.js').then(({ env }) => console.log('CORS_ORIGINS_JSON=' + JSON.stringify(env.corsOrigins)))",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "production",
          CORS_ORIGINS: "https://app.example.com/, https://admin.example.com",
          MAILER: "smtp",
          JWT_SECRET,
          CSRF_SECRET,
        },
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    const line = result.stdout
      .split(/\r?\n/)
      .find((value) => value.startsWith("CORS_ORIGINS_JSON="));
    expect(JSON.parse(line.slice("CORS_ORIGINS_JSON=".length))).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("rejects malformed CORS origins", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      CORS_ORIGINS: "not-an-origin",
      MAILER: "smtp",
      JWT_SECRET,
      CSRF_SECRET,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'CORS_ORIGINS entry "not-an-origin" is not a valid origin'
    );
  });

  it("rejects a permissive trust proxy in production", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://app.example.com",
      MAILER: "smtp",
      JWT_SECRET,
      CSRF_SECRET,
      TRUST_PROXY: "true",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("TRUST_PROXY=true is unsafe in production");
  });

  it("accepts a proxy hop count in production", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://app.example.com",
      MAILER: "smtp",
      JWT_SECRET,
      CSRF_SECRET,
      TRUST_PROXY: "1",
    });
    expect(result.status).toBe(0);
  });

  it("requires secure cookies for SameSite=None", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://app.example.com",
      MAILER: "smtp",
      JWT_SECRET,
      CSRF_SECRET,
      COOKIE_SAMESITE: "none",
      COOKIE_SECURE: "false",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'COOKIE_SAMESITE="none" requires COOKIE_SECURE=true'
    );
  });

  it("requires an explicit CSRF_SECRET in production", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://app.example.com",
      MAILER: "smtp",
      JWT_SECRET,
      CSRF_SECRET: "",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing required variable CSRF_SECRET");
  });

  it("requires CSRF_SECRET to be at least 32 characters", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://app.example.com",
      MAILER: "smtp",
      JWT_SECRET,
      CSRF_SECRET: "too-short",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "CSRF_SECRET must be at least 32 characters long"
    );
  });

  it("requires CSRF_SECRET to differ from JWT_SECRET in production", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://app.example.com",
      MAILER: "smtp",
      JWT_SECRET,
      CSRF_SECRET: JWT_SECRET,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("CSRF_SECRET must differ from JWT_SECRET");
  });

  it("derives CSRF_SECRET from JWT_SECRET outside production", () => {
    const result = loadEnv({
      NODE_ENV: "development",
      JWT_SECRET,
      CSRF_SECRET: "",
    });
    expect(result.status).toBe(0);
  });
});
