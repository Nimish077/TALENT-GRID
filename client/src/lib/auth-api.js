import { apiFetch } from "./api-client.js";
import { clearCsrfToken, setCsrfToken } from "./csrf-token.js";
import { clearCurrentUser, setCurrentUser } from "./session-store.js";

let refreshPromise = null;

function applySession(payload) {
  const token = payload?.data?.csrf_token;
  if (typeof token === "string" && token.length > 0) {
    setCsrfToken(token);
  }

  const user = payload?.data?.user;
  if (user) {
    setCurrentUser(user);
  }

  return payload;
}

function isRetryableRefresh(error) {
  return (
    error?.status === 401 &&
    typeof error?.payload?.message === "string" &&
    /retry/i.test(error.payload.message)
  );
}

export async function login(credentials) {
  return applySession(
    await apiFetch("/auth/login", { method: "POST", body: credentials })
  );
}

export async function register(input) {
  return applySession(
    await apiFetch("/auth/register", { method: "POST", body: input })
  );
}

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = apiFetch("/auth/refresh", { method: "POST" })
      .then(applySession)
      .catch((error) => {
        const isAuthFailure = error?.status === 401 || error?.status === 403;
        if (isAuthFailure && !isRetryableRefresh(error)) {
          clearCsrfToken();
          clearCurrentUser();
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function logout() {
  try {
    return await apiFetch("/auth/logout", { method: "POST" });
  } finally {
    clearCsrfToken();
    clearCurrentUser();
  }
}

export async function fetchCurrentUser() {
  try {
    const payload = await apiFetch("/auth/me");
    setCurrentUser(payload?.data?.user ?? null);
    return payload;
  } catch (error) {
    if (error?.status === 401) {
      clearCurrentUser();
    }
    throw error;
  }
}
