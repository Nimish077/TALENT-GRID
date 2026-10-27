// Validated, frozen environment configuration.
//
// Loaded once at startup. Anything that is missing or contradictory fails fast
// here rather than at an obscure point later. Production-specific guards:
//   - console mailer is rejected (dev-only OTP sink)
//   - CORS_ORIGINS must be explicit
//   - cookie SameSite=None requires Secure cookies
//
// Test-specific guards (Safeguard: tests can never touch the dev database):
//   - TEST_DATABASE_URI is required
//   - it must differ from DATABASE_URI
//   - its database name must contain "test"

import "dotenv/config";
import { hkdfSync } from "node:crypto";

const NODE_ENV = process.env.NODE_ENV ?? "development";
const isProduction = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

function fail(message) {
  throw new Error(`Invalid environment configuration: ${message}`);
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`missing required variable ${name}`);
  return value;
}

function optionalString(name) {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
}

function intVar(name, fallback, { min = 1 } = {}) {
  const raw = optionalString(name);
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min) {
    fail(`${name} must be an integer >= ${min}`);
  }
  return value;
}

function boolVar(name, fallback) {
  const raw = optionalString(name);
  if (raw === undefined) return fallback;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return fail(`${name} must be "true" or "false"`);
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

const databaseUri = required("DATABASE_URI");
const port = intVar("PORT", 8000);

let testDatabaseUri;
if (isTest) {
  testDatabaseUri = required("TEST_DATABASE_URI");
  if (testDatabaseUri === databaseUri) {
    fail("TEST_DATABASE_URI must not equal DATABASE_URI");
  }
  let dbName;
  try {
    dbName = new URL(testDatabaseUri).pathname;
  } catch {
    fail("TEST_DATABASE_URI is not a valid URL");
  }
  if (!/test/i.test(dbName)) {
    fail(
      `TEST_DATABASE_URI database name must contain "test" (got "${dbName}")`
    );
  }
}
const activeDatabaseUri = isTest ? testDatabaseUri : databaseUri;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) {
  fail("JWT_SECRET must be at least 32 characters long");
}

const csrfSecret =
  optionalString("CSRF_SECRET") ??
  Buffer.from(
    hkdfSync("sha256", jwtSecret, "talentgrid", "csrf-token", 32)
  ).toString("hex");

if (csrfSecret.length < 32) {
  fail("CSRF_SECRET must be at least 32 characters long");
}

const accessTokenTtlSeconds = intVar("ACCESS_TOKEN_TTL_SECONDS", 15 * 60);
const sessionTtlDays = intVar("SESSION_TTL_DAYS", 30);
const refreshReuseGraceSeconds = intVar("REFRESH_REUSE_GRACE_SECONDS", 30, {
  min: 0,
});

// ---------------------------------------------------------------------------
// Cookies & CORS
// ---------------------------------------------------------------------------

const cookieSecure = boolVar("COOKIE_SECURE", isProduction);

const cookieSameSite = (
  optionalString("COOKIE_SAMESITE") ?? "lax"
).toLowerCase();
if (!["lax", "strict", "none"].includes(cookieSameSite)) {
  fail('COOKIE_SAMESITE must be one of "lax", "strict", "none"');
}
if (cookieSameSite === "none" && !cookieSecure) {
  fail('COOKIE_SAMESITE="none" requires COOKIE_SECURE=true');
}

const corsOriginsRaw = optionalString("CORS_ORIGINS");
if (!corsOriginsRaw && isProduction) {
  fail("CORS_ORIGINS must be set explicitly in production");
}
const corsOrigins = (
  corsOriginsRaw ?? "http://localhost:3000,http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const cookieBase = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  domain: optionalString("COOKIE_DOMAIN"),
};

// ---------------------------------------------------------------------------
// Mailer / OTP
// ---------------------------------------------------------------------------

const mailer = (
  optionalString("MAILER") ?? (isTest ? "test" : "console")
).toLowerCase();
if (!["console", "smtp", "test"].includes(mailer)) {
  fail('MAILER must be one of "console", "smtp", "test"');
}
if (isProduction && mailer === "console") {
  fail(
    "MAILER=console is not allowed in production (OTP codes would only reach the server log)"
  );
}

const otpTtlMinutes = intVar("OTP_TTL_MINUTES", 10);
const otpMaxAttempts = intVar("OTP_MAX_ATTEMPTS", 5);

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

const bcryptRounds = intVar("BCRYPT_ROUNDS", 12);
const assessmentEngineToken = optionalString("ASSESSMENT_ENGINE_TOKEN");
const trustProxyRaw = optionalString("TRUST_PROXY");
let trustProxy = false;
if (trustProxyRaw !== undefined) {
  if (trustProxyRaw === "true") trustProxy = true;
  else if (trustProxyRaw === "false") trustProxy = false;
  else {
    const hops = Number.parseInt(trustProxyRaw, 10);
    if (!Number.isInteger(hops) || hops < 0)
      fail("TRUST_PROXY must be true, false or a hop count");
    trustProxy = hops;
  }
}

export const env = Object.freeze({
  nodeEnv: NODE_ENV,
  isProduction,
  isTest,
  port,
  databaseUri,
  testDatabaseUri,
  activeDatabaseUri,
  jwtSecret,
  csrfSecret,
  accessTokenTtlSeconds,
  sessionTtlSeconds: sessionTtlDays * 24 * 60 * 60,
  refreshReuseGraceSeconds,
  cookieSecure,
  cookieSameSite,
  cookieBase,
  corsOrigins,
  mailer,
  otpTtlMinutes,
  otpMaxAttempts,
  bcryptRounds,
  assessmentEngineToken,
  trustProxy,
});
