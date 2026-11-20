import { API_BASE_URL } from "./config.js";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrf-token.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let bootstrapPromise = null;

export class ApiRequestError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function isTalentGridApiUrl(url) {
  try {
    const base = new URL(API_BASE_URL, window.location.origin);
    const target = new URL(url, window.location.origin);
    if (target.origin !== base.origin) return false;
    return (
      target.pathname === base.pathname ||
      target.pathname.startsWith(`${base.pathname}/`)
    );
  } catch {
    return false;
  }
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorFromResponse(response, payload) {
  return new ApiRequestError(
    payload?.message ?? `Request failed with status ${response.status}`,
    response.status,
    payload
  );
}

export function bootstrapCsrf() {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const response = await fetch(buildUrl("/auth/csrf"), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload = await parseResponse(response);

    if (!response.ok) {
      throw errorFromResponse(response, payload);
    }

    const token = payload?.data?.csrf_token;
    if (typeof token !== "string" || token.length === 0) {
      throw new ApiRequestError(
        "CSRF bootstrap response did not contain a token",
        response.status,
        payload
      );
    }

    setCsrfToken(token);
    return token;
  })().finally(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

export async function ensureCsrfToken() {
  return getCsrfToken() ?? bootstrapCsrf();
}

async function request(path, options = {}, retryOnCsrfFailure = true) {
  const { method = "GET", headers, body, credentials, ...rest } = options;

  const upperMethod = method.toUpperCase();
  const url = buildUrl(path);
  const isApiRequest = isTalentGridApiUrl(url);
  const requestHeaders = new Headers(headers ?? {});
  const hasExplicitCsrf = requestHeaders.has("X-CSRF-Token");

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  const isJsonBody =
    body !== undefined &&
    body !== null &&
    typeof body === "object" &&
    !isFormData;

  if (isJsonBody && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (isApiRequest && MUTATING_METHODS.has(upperMethod) && !hasExplicitCsrf) {
    requestHeaders.set("X-CSRF-Token", await ensureCsrfToken());
  }

  const response = await fetch(url, {
    ...rest,
    method: upperMethod,
    headers: requestHeaders,
    body: isJsonBody ? JSON.stringify(body) : body,
    credentials: credentials ?? (isApiRequest ? "include" : "same-origin"),
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    const error = errorFromResponse(response, payload);
    const isCsrfFailure =
      response.status === 403 &&
      typeof payload?.message === "string" &&
      /csrf/i.test(payload.message);

    if (
      retryOnCsrfFailure &&
      isApiRequest &&
      MUTATING_METHODS.has(upperMethod) &&
      !hasExplicitCsrf &&
      isCsrfFailure
    ) {
      clearCsrfToken();
      await bootstrapCsrf();
      return request(path, options, false);
    }

    throw error;
  }

  return payload;
}

export function apiFetch(path, options = {}) {
  return request(path, options);
}
