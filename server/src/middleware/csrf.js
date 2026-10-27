// CSRF protection for cookie-authenticated state-changing requests.
//
// Policy (user-approved):
//   - Bearer requests are the deliberate non-browser transport → exempt.
//   - A fresh (cookie-less) login/register carries nothing to forge → exempt
//     from double-submit, but Origin is still validated when present.
//   - Everything else authenticated via cookies must pass BOTH:
//       1. exact Origin allowlist match (header must be present)
//       2. signed double-submit: X-CSRF-Token header equals the csrf_token
//          cookie and the cookie's HMAC signature verifies.

import { env } from "../config/env.js";
import { ApiError } from "../errors/apiError.js";
import { constantTimeEqual, isValidCsrfToken } from "../utils/tokens.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function csrfProtection(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (origin && !env.corsOrigins.includes(origin)) {
    throw new ApiError(403, "Request origin is not allowed");
  }

  const bearer = Boolean(req.get("authorization")?.startsWith("Bearer "));
  const hasAuthCookie = Boolean(
    req.cookies?.access_token || req.cookies?.refresh_token
  );

  if (bearer && !hasAuthCookie) return next();
  if (!hasAuthCookie && !req.cookies?.csrf_token) return next();

  if (!origin) {
    throw new ApiError(
      403,
      "Origin header is required for cookie-authenticated requests"
    );
  }

  const headerToken = req.get("x-csrf-token");
  const cookieToken = req.cookies?.csrf_token;
  const valid =
    typeof headerToken === "string" &&
    typeof cookieToken === "string" &&
    constantTimeEqual(headerToken, cookieToken) &&
    isValidCsrfToken(cookieToken);

  if (!valid) {
    throw new ApiError(403, "CSRF token missing or invalid");
  }

  next();
}
