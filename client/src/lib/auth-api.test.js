import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCurrentUser,
  login,
  logout,
  refreshSession,
  register,
} from "./auth-api.js";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrf-token.js";
import {
  clearCurrentUser,
  getCurrentUser,
  setCurrentUser,
} from "./session-store.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  clearCsrfToken();
  clearCurrentUser();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearCsrfToken();
  clearCurrentUser();
});

describe("login and registration", () => {
  it("updates the CSRF token and current user after login", async () => {
    setCsrfToken("old.token");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: { csrf_token: "login.token", user: { id: "user-1" } },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const payload = await login({
      email: "candidate@example.com",
      password: "Password123!",
    });

    expect(payload.data.csrf_token).toBe("login.token");
    expect(getCsrfToken()).toBe("login.token");
    expect(getCurrentUser()).toEqual({ id: "user-1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/auth/login");
    expect(init.headers.get("X-CSRF-Token")).toBe("old.token");
    expect(init.credentials).toBe("include");
  });

  it("updates the CSRF token and current user after registration", async () => {
    setCsrfToken("old.token");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: { csrf_token: "register.token", user: { id: "user-2" } },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await register({
      email: "candidate@example.com",
      password: "Password123!",
      full_name: "Candidate",
      role: "candidate",
    });

    expect(getCsrfToken()).toBe("register.token");
    expect(getCurrentUser()).toEqual({ id: "user-2" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/register");
  });

  it("bootstraps before login when no token is available", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { csrf_token: "boot.token" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: { csrf_token: "login.token", user: { id: "user-1" } },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await login({ email: "candidate@example.com", password: "Password123!" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/csrf");
    expect(fetchMock.mock.calls[1][1].headers.get("X-CSRF-Token")).toBe(
      "boot.token"
    );
    expect(getCsrfToken()).toBe("login.token");
  });
});

describe("refreshSession", () => {
  it("rotates the in-memory token and user from the refresh response", async () => {
    setCsrfToken("old.token");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: { csrf_token: "refresh.token", user: { id: "user-1" } },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await refreshSession();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/refresh");
    expect(fetchMock.mock.calls[0][1].headers.get("X-CSRF-Token")).toBe(
      "old.token"
    );
    expect(getCsrfToken()).toBe("refresh.token");
    expect(getCurrentUser()).toEqual({ id: "user-1" });
  });

  it("collapses concurrent refreshes into one request", async () => {
    setCsrfToken("old.token");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: { csrf_token: "refresh.token", user: { id: "user-1" } },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      refreshSession(),
      refreshSession(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(getCsrfToken()).toBe("refresh.token");
  });

  it("clears local state when the refresh token is invalid", async () => {
    setCsrfToken("old.token");
    setCurrentUser({ id: "user-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: "Invalid or expired refresh token" }, 401)
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
    expect(getCsrfToken()).toBeNull();
    expect(getCurrentUser()).toBeNull();
  });

  it("keeps local state during the concurrent-refresh grace response", async () => {
    setCsrfToken("old.token");
    setCurrentUser({ id: "user-1" });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          message:
            "Session refresh already in progress; retry with the updated cookie",
        },
        401
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
    expect(getCsrfToken()).toBe("old.token");
    expect(getCurrentUser()).toEqual({ id: "user-1" });
  });

  it("does not loop or clear state on a server error", async () => {
    setCsrfToken("old.token");
    setCurrentUser({ id: "user-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: "Internal server error" }, 500)
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshSession()).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCsrfToken()).toBe("old.token");
    expect(getCurrentUser()).toEqual({ id: "user-1" });
  });
});

describe("logout", () => {
  it("sends the CSRF header and clears CSRF + user state", async () => {
    setCsrfToken("old.token");
    setCurrentUser({ id: "user-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Logged out" }));
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/logout");
    expect(fetchMock.mock.calls[0][1].headers.get("X-CSRF-Token")).toBe(
      "old.token"
    );
    expect(getCsrfToken()).toBeNull();
    expect(getCurrentUser()).toBeNull();
  });

  it("clears local state even when the request fails", async () => {
    setCsrfToken("old.token");
    setCurrentUser({ id: "user-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "unavailable" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(logout()).rejects.toMatchObject({ status: 500 });
    expect(getCsrfToken()).toBeNull();
    expect(getCurrentUser()).toBeNull();
  });
});

describe("fetchCurrentUser", () => {
  it("stores the returned user", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { user: { id: "user-1" } } }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCurrentUser();

    expect(getCurrentUser()).toEqual({ id: "user-1" });
    expect(fetchMock.mock.calls[0][1].headers.has("X-CSRF-Token")).toBe(false);
  });

  it("clears the current user on a 401", async () => {
    setCurrentUser({ id: "user-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: "Authentication required" }, 401)
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentUser()).rejects.toMatchObject({ status: 401 });
    expect(getCurrentUser()).toBeNull();
  });
});
