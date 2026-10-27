// Minimal cookie parsing + attribute-aware setters.
//
// Cookie layout:
//   access_token   httpOnly  Path=/api/v1        short-lived JWT
//   refresh_token  httpOnly  Path=/api/v1/auth   opaque rotating token
//   csrf_token     readable  Path=/              signed double-submit token

import { env } from "../config/env.js";

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) {
    const value =
      options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1);
    parts.push(`SameSite=${value}`);
  }
  return parts.join("; ");
}

function appendCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");
  const cookies = existing
    ? Array.isArray(existing)
      ? [...existing]
      : [existing]
    : [];
  cookies.push(cookie);
  res.setHeader("Set-Cookie", cookies);
}

const ACCESS_PATH = "/api/v1";
const REFRESH_PATH = "/api/v1/auth";

export function setAuthCookies(res, { accessToken, refreshToken, csrfToken }) {
  appendCookie(
    res,
    serializeCookie("access_token", accessToken, {
      ...env.cookieBase,
      httpOnly: true,
      path: ACCESS_PATH,
      maxAge: env.accessTokenTtlSeconds,
    })
  );
  if (refreshToken) {
    appendCookie(
      res,
      serializeCookie("refresh_token", refreshToken, {
        ...env.cookieBase,
        httpOnly: true,
        path: REFRESH_PATH,
        maxAge: env.sessionTtlSeconds,
      })
    );
  }
  if (csrfToken) {
    appendCookie(
      res,
      serializeCookie("csrf_token", csrfToken, {
        ...env.cookieBase,
        httpOnly: false,
        path: "/",
        maxAge: env.sessionTtlSeconds,
      })
    );
  }
}

export function clearAuthCookies(res) {
  for (const [name, path] of [
    ["access_token", ACCESS_PATH],
    ["refresh_token", REFRESH_PATH],
    ["csrf_token", "/"],
  ]) {
    appendCookie(
      res,
      serializeCookie(name, "", { ...env.cookieBase, path, maxAge: 0 })
    );
  }
}
