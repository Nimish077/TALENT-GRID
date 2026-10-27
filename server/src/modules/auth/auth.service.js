// Authentication & session lifecycle.
//
// Refresh rotation is strictly atomic: the presented token is claimed with a
// single conditional UPDATE (revoked_at IS NULL -> now). A replacement session
// is ONLY created when that claim succeeds, so a concurrent refresh can never
// produce two live sessions. The loser of the race gets a short grace window
// (REFRESH_REUSE_GRACE_SECONDS) to retry with the cookie the winner returned —
// beyond that window a rotated token is treated as theft and the whole family
// is revoked.

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from "../../utils/tokens.js";

export function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    phone: user.phone,
    avatar_url: user.avatar_url,
    role: user.role,
    status: user.status,
    email_verified_at: user.email_verified_at,
    created_at: user.created_at,
  };
}

function requestMeta(req) {
  return {
    user_agent: req.get("user-agent")?.slice(0, 255) ?? null,
    ip_address: req.ip ?? null,
  };
}

export async function registerUser(input) {
  const password_hash = await bcrypt.hash(input.password, env.bcryptRounds);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        password_hash,
        full_name: input.full_name,
        phone: input.phone ?? null,
        role: input.role,
      },
    });

    if (input.role === "candidate") {
      await tx.candidateProfile.create({ data: { user_id: user.id } });
    }

    if (input.role === "employer") {
      const organization = await tx.organization.create({
        data: { ...input.organization },
      });
      await tx.organizationUser.create({
        data: {
          user_id: user.id,
          organization_id: organization.id,
          role: "owner",
          status: "pending",
        },
      });
    }

    if (input.role === "institute") {
      const institution = await tx.institution.create({
        data: { ...input.institution },
      });
      await tx.institutionUser.create({
        data: {
          user_id: user.id,
          institution_id: institution.id,
          role: "owner",
          status: "pending",
        },
      });
    }

    return user;
  });
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches =
    user && (await bcrypt.compare(password, user.password_hash));
  if (!user || !passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }
  if (user.status !== "active") {
    throw new ApiError(403, "Account is suspended");
  }
  return user;
}

export async function createSession(user, req) {
  const refreshToken = generateRefreshToken();
  const session = await prisma.session.create({
    data: {
      user_id: user.id,
      family_id: randomUUID(),
      refresh_token_hash: hashRefreshToken(refreshToken),
      ...requestMeta(req),
      expires_at: new Date(Date.now() + env.sessionTtlSeconds * 1000),
    },
  });
  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
    sessionId: session.id,
  });
  return { accessToken, refreshToken };
}

async function issueReplacementSession(previousSession, req) {
  const refreshToken = generateRefreshToken();
  const session = await prisma.session.create({
    data: {
      user_id: previousSession.user_id,
      family_id: previousSession.family_id,
      refresh_token_hash: hashRefreshToken(refreshToken),
      ...requestMeta(req),
      expires_at: new Date(Date.now() + env.sessionTtlSeconds * 1000),
    },
  });
  const accessToken = await signAccessToken({
    userId: previousSession.user_id,
    role: previousSession.user.role,
    sessionId: session.id,
  });
  return { accessToken, refreshToken };
}

// Returns one of:
//   { status: "rotated", user, accessToken, refreshToken }  -> set cookies
//   { status: "grace" }        -> 401, KEEP cookies (retry with new cookie)
//   { status: "reuse" }        -> family revoked; clear cookies, 401
//   { status: "invalid" }      -> clear cookies, 401
export async function rotateSession(rawRefreshToken, req) {
  if (!rawRefreshToken) return { status: "invalid" };
  const hash = hashRefreshToken(rawRefreshToken);

  const claimed = await prisma.session.updateMany({
    where: {
      refresh_token_hash: hash,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    data: { revoked_at: new Date(), revoke_reason: "rotated" },
  });

  if (claimed.count === 1) {
    const previousSession = await prisma.session.findUnique({
      where: { refresh_token_hash: hash },
      include: { user: true },
    });
    if (!previousSession || previousSession.user.status !== "active") {
      return { status: "invalid" };
    }
    const tokens = await issueReplacementSession(previousSession, req);
    return { status: "rotated", user: previousSession.user, ...tokens };
  }

  const existing = await prisma.session.findUnique({
    where: { refresh_token_hash: hash },
  });
  if (!existing) return { status: "invalid" };

  if (existing.revoked_at) {
    if (existing.revoke_reason === "rotated") {
      const ageMs = Date.now() - existing.revoked_at.getTime();
      if (ageMs <= env.refreshReuseGraceSeconds * 1000) {
        return { status: "grace" };
      }
      await prisma.session.updateMany({
        where: { family_id: existing.family_id, revoked_at: null },
        data: { revoked_at: new Date(), revoke_reason: "reuse_detected" },
      });
      return { status: "reuse" };
    }
    return { status: "invalid" };
  }

  // Not revoked and claim lost => expired (UPDATE excluded it).
  return { status: "invalid" };
}

export async function revokeByRefreshToken(rawRefreshToken, reason = "logout") {
  if (!rawRefreshToken) return;
  await prisma.session.updateMany({
    where: {
      refresh_token_hash: hashRefreshToken(rawRefreshToken),
      revoked_at: null,
    },
    data: { revoked_at: new Date(), revoke_reason: reason },
  });
}
