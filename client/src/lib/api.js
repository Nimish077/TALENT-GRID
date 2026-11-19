// Thin fetch wrapper for the TalentGrid API (`/api/v1`).
// Auth is cookie-based: we send credentials and echo the readable csrf_token
// cookie in `x-csrf-token` on mutating requests. In dev, Vite proxies /api to
// the Express server, so everything is same-origin. Override with VITE_API_URL.

export const API_BASE = import.meta.env?.VITE_API_URL ?? "/api/v1";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
      this.details.filter((d) => d?.path).map((d) => [d.path, d.message]),
    );
  }
}

function readCookie(name) {
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export async function apiRequest(path, { method = "GET", body, headers } = {}) {
  const finalHeaders = { Accept: "application/json", ...headers };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (MUTATING.has(method)) {
    const csrf = readCookie("csrf_token");
    if (csrf) finalHeaders["x-csrf-token"] = csrf;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      response.status,
      payload?.message ?? "Something went wrong. Please try again.",
      payload?.error ?? [],
    );
  }
  return payload?.data ?? null;
}

export const authApi = {
  me: () => apiRequest("/auth/me"),
  login: (credentials) => apiRequest("/auth/login", { method: "POST", body: credentials }),
  register: (input) => apiRequest("/auth/register", { method: "POST", body: input }),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),
};
