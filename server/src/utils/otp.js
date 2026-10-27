// OTP generation and hashing for institution membership claims.
//
// Codes are 6 digits, stored only as HMAC-SHA256(secret, context + ":" + otp)
// so a leaked database row cannot be replayed. The context binds a code to the
// specific claim (membership id + email), preventing cross-claim reuse.

import { createHmac, hkdfSync, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

const otpHashSecret = Buffer.from(
  hkdfSync("sha256", env.jwtSecret, "talentgrid", "otp-hash", 32)
);

export function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(otp, context) {
  return createHmac("sha256", otpHashSecret)
    .update(`${context}:${otp}`)
    .digest("hex");
}

export function verifyOtp(otp, context, expectedHash) {
  const actual = Buffer.from(hashOtp(otp, context), "hex");
  const expected = Buffer.from(String(expectedHash), "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
