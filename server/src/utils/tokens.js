// Token helpers: access JWTs (jose), opaque refresh tokens, signed CSRF tokens.

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const ISSUER = "talentgrid";
const AUDIENCE = "talentgrid-api";

const secretKey = new TextEncoder().encode(env.jwtSecret);

export async function signAccessToken({ userId, role, sessionId }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role, sid: sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + env.accessTokenTtlSeconds)
    .sign(secretKey);
}

export async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}

export function generateRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function constantTimeEqual(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

// ---------------------------------------------------------------------------
// CSRF: signed double-submit token.
// Value format: "<nonce>.<hmac(nonce)>" — the HMAC binds it to our secret so a
// forged cookie alone is not enough (an attacker able to set cookies on the
// victim's browser still cannot produce a valid signature).
// ---------------------------------------------------------------------------

function signValue(nonce) {
  return createHmac("sha256", env.csrfSecret).update(nonce).digest("base64url");
}

export function createCsrfToken() {
  const nonce = randomBytes(16).toString("base64url");
  return `${nonce}.${signValue(nonce)}`;
}

export function isValidCsrfToken(token) {
  if (typeof token !== "string") return false;
  const index = token.lastIndexOf(".");
  if (index <= 0) return false;
  const nonce = token.slice(0, index);
  const signature = token.slice(index + 1);
  return constantTimeEqual(signature, signValue(nonce));
}
