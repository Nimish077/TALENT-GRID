import { Router } from "express";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authLimiter } from "../../middleware/rateLimits.js";
import { setAuthCookies, clearAuthCookies } from "../../utils/cookies.js";
import { createCsrfToken } from "../../utils/tokens.js";
import { sendSuccess } from "../../utils/response.js";
import { ApiError } from "../../errors/apiError.js";
import { registerSchema, loginSchema } from "./auth.schemas.js";
import {
  registerUser,
  loginUser,
  createSession,
  rotateSession,
  revokeByRefreshToken,
  sanitizeUser,
} from "./auth.service.js";

const router = Router();

function setSessionCookies(res, tokens) {
  setAuthCookies(res, { ...tokens, csrfToken: createCsrfToken() });
}

// The access token is also returned in the body for non-browser (Bearer)
// clients; browsers rely on the httpOnly cookies. The refresh token is only
// ever delivered as an httpOnly cookie.
function bodyTokens(tokens) {
  return {
    token_type: "Bearer",
    access_token: tokens.accessToken,
    expires_in: env.accessTokenTtlSeconds,
  };
}

router.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const user = await registerUser(req.body);
    const tokens = await createSession(user, req);
    setSessionCookies(res, tokens);
    return sendSuccess(res, {
      statusCode: 201,
      message: "Registration successful",
      data: { user: sanitizeUser(user), tokens: bodyTokens(tokens) },
    });
  })
);

router.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const user = await loginUser(req.body);
    const tokens = await createSession(user, req);
    setSessionCookies(res, tokens);
    return sendSuccess(res, {
      message: "Login successful",
      data: { user: sanitizeUser(user), tokens: bodyTokens(tokens) },
    });
  })
);

router.post(
  "/refresh",
  authLimiter,
  asyncHandler(async (req, res) => {
    const result = await rotateSession(req.cookies?.refresh_token, req);

    if (result.status === "grace") {
      // A concurrent refresh already rotated this token moments ago. Do NOT
      // clear cookies: the client retries and picks up the winner's cookie.
      throw new ApiError(
        401,
        "Session refresh already in progress; retry with the updated cookie"
      );
    }

    if (result.status !== "rotated") {
      clearAuthCookies(res);
      throw new ApiError(
        401,
        result.status === "reuse"
          ? "Refresh token reuse detected; all sessions in this family were revoked"
          : "Invalid or expired refresh token"
      );
    }

    setSessionCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return sendSuccess(res, {
      message: "Session refreshed",
      data: {
        user: sanitizeUser(result.user),
        tokens: bodyTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        }),
      },
    });
  })
);

router.post(
  "/logout",
  authLimiter,
  asyncHandler(async (req, res) => {
    await revokeByRefreshToken(req.cookies?.refresh_token);
    clearAuthCookies(res);
    return sendSuccess(res, { message: "Logged out" });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    return sendSuccess(res, { data: { user: sanitizeUser(req.auth.user) } });
  })
);

export default router;
