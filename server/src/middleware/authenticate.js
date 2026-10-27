import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../errors/apiError.js";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";

function extractToken(req) {
  const header = req.get("authorization");
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) return { token, via: "bearer" };
  }
  if (req.cookies?.access_token) {
    return { token: req.cookies.access_token, via: "cookie" };
  }
  return null;
}

// Best-effort authentication: returns the auth context or null. Suspended
// accounts are rejected loudly even on public endpoints.
async function resolveAuth(req) {
  const extracted = extractToken(req);
  if (!extracted) return null;

  const payload = await verifyAccessToken(extracted.token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;
  if (user.status !== "active") {
    throw new ApiError(403, "Account is suspended");
  }

  return { user, via: extracted.via, sessionId: payload.sid };
}

export const authenticate = asyncHandler(async (req, res, next) => {
  const auth = await resolveAuth(req);
  if (!auth) throw new ApiError(401, "Authentication required");
  req.auth = auth;
  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  req.auth = await resolveAuth(req);
  next();
});
