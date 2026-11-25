import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  apiRequest,
  authApi,
  bootstrapCsrfToken,
  clearCsrfToken,
  getCsrfToken,
  setCsrfToken,
  setUnauthorizedHandler,
} from "./api.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

beforeEach(() => {
  clearCsrfToken();
  document.cookie =
    "csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CSRF bootstrap", () => {
  it("fetches and stores a token from the bootstrap endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: { csrf_token: "nonce.signature" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(bootstrapCsrfToken()).resolves.toBe("nonce.signature");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/auth/csrf`,
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
    expect(getCsrfToken()).toBe("nonce.signature");
  });

  it("rejects a response without a token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { success: true, data: {} }))
    );

    await expect(bootstrapCsrfToken()).rejects.toMatchObject({
      status: 200,
      message: /did not issue a CSRF token/,
    });
  });
});

describe("request token handling", () => {
  it("does not bootstrap for login and stores the token from the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: {
          user: { id: "u1" },
          tokens: { access_token: "a" },
          csrf_token: "login.signature",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await authApi.login({ email: "a@b.com", password: "secret123" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/auth/login`);
    expect(options.headers["x-csrf-token"]).toBeUndefined();
    expect(getCsrfToken()).toBe("login.signature");
  });

  it("bootstraps before a mutation and sends the header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { csrf_token: "boot.signature" },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: { ok: true } })
      );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/candidates/me", {
      method: "PATCH",
      body: { headline: "Dev" },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE}/auth/csrf`,
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe(`${API_BASE}/candidates/me`);
    expect(options.method).toBe("PATCH");
    expect(options.credentials).toBe("include");
    expect(options.headers["x-csrf-token"]).toBe("boot.signature");
    expect(options.body).toBe(JSON.stringify({ headline: "Dev" }));
  });

  it("retries once after a CSRF 403 with a fresh bootstrap token", async () => {
    setCsrfToken("stale.signature");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(403, {
          success: false,
          message: "CSRF token missing or invalid",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { csrf_token: "fresh.signature" },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: { ok: true } })
      );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/candidates/me", {
      method: "PATCH",
      body: { headline: "Dev" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE}/auth/csrf`);
    const [, retryOptions] = fetchMock.mock.calls[2];
    expect(retryOptions.headers["x-csrf-token"]).toBe("fresh.signature");
    expect(getCsrfToken()).toBe("fresh.signature");
  });

  it("does not retry a non-CSRF 403", async () => {
    setCsrfToken("valid.signature");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, {
        success: false,
        message: "Request origin is not allowed",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiRequest("/candidates/me", { method: "PATCH" })
    ).rejects.toMatchObject({ status: 403, message: /origin/i });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send the header on safe requests", async () => {
    setCsrfToken("valid.signature");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, data: { user: { id: "u1" } } })
      );
    vi.stubGlobal("fetch", fetchMock);

    await authApi.me();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers["x-csrf-token"]).toBeUndefined();
  });

  it("clears the in-memory token after logout", async () => {
    setCsrfToken("valid.signature");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse(200, { success: true, data: null }))
    );

    await authApi.logout();

    expect(getCsrfToken()).toBeNull();
  });
});

describe("error messages", () => {
  const login = () => apiRequest("/auth/login", { method: "POST", body: {} });

  it("hides raw server errors behind a friendly message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(500, {
          success: false,
          message: "\nInvalid `prisma.user.findUnique()` invocation",
          error: [],
        })
      )
    );

    const error = await login().catch((e) => e);
    expect(error.message).toMatch(/having trouble/i);
    expect(error.message).not.toMatch(/prisma/i);
  });

  it("treats a non-JSON reply (no API deployed) as a server problem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockRejectedValue(new Error("not json")),
      })
    );

    const error = await login().catch((e) => e);
    expect(error.status).toBe(404);
    expect(error.message).toMatch(/having trouble/i);
  });

  it("keeps 4xx messages and field errors from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(422, {
          success: false,
          message: "Validation failed",
          error: [{ path: "email", message: "Invalid email" }],
        })
      )
    );

    const error = await login().catch((e) => e);
    expect(error.message).toBe("Validation failed");
    expect(error.fieldErrors).toEqual({ email: "Invalid email" });
  });
});

describe("session refresh", () => {
  const ok = (data = {}) => jsonResponse(200, { success: true, data });
  const unauthorized = () =>
    jsonResponse(401, { success: false, message: "Authentication required", error: [] });

  afterEach(() => setUnauthorizedHandler(null));

  it("refreshes once on a 401 and retries the original request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorized()) // GET /auth/me
      .mockResolvedValueOnce(ok({ csrf_token: "t.sig" })) // csrf bootstrap for refresh
      .mockResolvedValueOnce(ok({ csrf_token: "t.sig" })) // POST /auth/refresh
      .mockResolvedValueOnce(ok({ user: { id: "1" } })); // retried GET /auth/me
    vi.stubGlobal("fetch", fetchMock);

    await expect(authApi.me()).resolves.toEqual({ user: { id: "1" } });
    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls.filter((url) => url.endsWith("/auth/refresh"))).toHaveLength(1);
    expect(urls.filter((url) => url.endsWith("/auth/me"))).toHaveLength(2);
  });

  it("signs the user out when the refresh fails", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) =>
        url.endsWith("/auth/csrf")
          ? ok({ csrf_token: "t.sig" })
          : unauthorized()
      )
    );

    await expect(authApi.me()).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("shares one refresh between concurrent 401s", async () => {
    const calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) => {
        calls.push(url);
        if (url.endsWith("/auth/csrf") || url.endsWith("/auth/refresh")) {
          return ok({ csrf_token: "t.sig" });
        }
        const secondTime = calls.filter((u) => u === url).length > 1;
        return secondTime ? ok({ items: [] }) : unauthorized();
      })
    );

    await Promise.all([
      apiRequest("/jobs"),
      apiRequest("/applications/mine"),
    ]);
    expect(calls.filter((url) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("does not try to refresh after a failed login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(unauthorized());
    vi.stubGlobal("fetch", fetchMock);

    await expect(authApi.login({ email: "a@b.com", password: "x" })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
