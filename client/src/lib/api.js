// Thin fetch wrapper for the TalentGrid API (`/api/v1`).
// Auth is cookie-based. The signed CSRF token is bootstrapped from
// `GET /auth/csrf` (or an auth response) and kept in memory; mutating requests
// echo it in `x-csrf-token`. In dev, Vite proxies /api to the Express server,
// so everything is same-origin. Override with VITE_API_BASE_URL.

export const API_BASE = (
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  "/api/v1"
).replace(/\/$/, "");

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_EXEMPT = new Set(["/auth/login", "/auth/register"]);

let csrfToken = null;

export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  // Map `[{ path, message }]` from a 422 to `{ "organization.name": "..." }`.
  get fieldErrors() {
    return Object.fromEntries(
      this.details.filter((d) => d?.path).map((d) => [d.path, d.message])
    );
  }
}

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function getCsrfToken() {
  return csrfToken;
}

export function setCsrfToken(token) {
  csrfToken = typeof token === "string" && token ? token : null;
  return csrfToken;
}

export function clearCsrfToken() {
  csrfToken = null;
}

async function parsePayload(response) {
  return response.json().catch(() => null);
}

async function fetchJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new ApiError(
      0,
      "Cannot reach the server. Check your connection and try again."
    );
  }
  return { response, payload: await parsePayload(response) };
}

function apiError(response, payload) {
  return new ApiError(
    response.status,
    payload?.message ?? "Something went wrong. Please try again.",
    payload?.error ?? []
  );
}

export async function bootstrapCsrfToken() {
  const { response, payload } = await fetchJson(`${API_BASE}/auth/csrf`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok || payload?.success === false) {
    throw apiError(response, payload);
  }

  const token = payload?.data?.csrf_token;
  if (typeof token !== "string" || !token) {
    throw new ApiError(
      response.status,
      "The server did not issue a CSRF token"
    );
  }

  return setCsrfToken(token);
}

async function csrfTokenForRequest(path) {
  if (CSRF_EXEMPT.has(path)) return null;
  if (csrfToken) return csrfToken;
  const cookieToken = readCookie("csrf_token");
  if (cookieToken) return setCsrfToken(cookieToken);
  return bootstrapCsrfToken();
}

function requestOptions({ method, body, headers }, token) {
  const finalHeaders = { Accept: "application/json", ...headers };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (token) finalHeaders["x-csrf-token"] = token;

  return {
    method,
    credentials: "include",
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function isCsrfFailure(response, payload) {
  return response.status === 403 && /csrf/i.test(payload?.message ?? "");
}

export async function apiRequest(path, { method = "GET", body, headers } = {}) {
  const mutating = MUTATING.has(method);
  const csrf = mutating ? await csrfTokenForRequest(path) : null;

  let { response, payload } = await fetchJson(
    `${API_BASE}${path}`,
    requestOptions({ method, body, headers }, csrf)
  );

  if (mutating && !CSRF_EXEMPT.has(path) && isCsrfFailure(response, payload)) {
    const retryToken = await bootstrapCsrfToken();
    ({ response, payload } = await fetchJson(
      `${API_BASE}${path}`,
      requestOptions({ method, body, headers }, retryToken)
    ));
  }

  if (!response.ok || payload?.success === false) {
    throw apiError(response, payload);
  }

  if (payload?.data?.csrf_token) setCsrfToken(payload.data.csrf_token);
  if (path === "/auth/logout") clearCsrfToken();

  return payload?.data ?? null;
}

export const authApi = {
  me: () => apiRequest("/auth/me"),
  login: (credentials) =>
    apiRequest("/auth/login", { method: "POST", body: credentials }),
  register: (input) =>
    apiRequest("/auth/register", { method: "POST", body: input }),
  refreshSession: () => apiRequest("/auth/refresh", { method: "POST" }),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),
};
