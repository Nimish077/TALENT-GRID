import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  apiFetch,
  bootstrapCsrf,
  ensureCsrfToken,
} from "./api-client.js";
import {
  clearCsrfToken,
  getCsrfToken,
  setCsrfToken,
} from "./csrf-token.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  clearCsrfToken();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearCsrfToken();
});

describe("bootstrapCsrf", () => {
  it("fetches the bootstrap endpoint with credentials and stores the token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { csrf_token: "nonce.sig" } }));
    vi.stubGlobal("fetch", fetchMock);

    const token = await bootstrapCsrf();

    expect(token).toBe("nonce.sig");
    expect(getCsrfToken()).toBe("nonce.sig");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/csrf",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })
    );
  });

  it("reuses one in-flight bootstrap request", async () => {
    let resolveFetch;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = bootstrapCsrf();
    const second = bootstrapCsrf();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse({ data: { csrf_token: "one.token" } }));

    await expect(first).resolves.toBe("one.token");
    await expect(second).resolves.toBe("one.token");
  });

  it("fails clearly when the response has no token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: {} }))
    );

    await expect(bootstrapCsrf()).rejects.toBeInstanceOf(ApiRequestError);
  });
});

describe("ensureCsrfToken", () => {
  it("returns the in-memory token without a network request", async () => {
    setCsrfToken("existing.token");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureCsrfToken()).resolves.toBe("existing.token");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("apiFetch CSRF headers", () => {
  it("attaches the token to mutating methods only", async () => {
    setCsrfToken("nonce.sig");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      await apiFetch("/candidates/me", { method, body: {} });
    }
    await apiFetch("/candidates/me", { method: "GET" });

    for (const call of fetchMock.mock.calls.slice(0, 4)) {
      const [, init] = call;
      expect(init.headers.get("X-CSRF-Token")).toBe("nonce.sig");
      expect(init.credentials).toBe("include");
    }

    const [, getInit] = fetchMock.mock.calls[4];
    expect(getInit.headers.has("X-CSRF-Token")).toBe(false);
  });

  it("never sends the token to an external URL", async () => {
    setCsrfToken("nonce.sig");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("https://evil.example.com/collect", {
      method: "POST",
      body: { value: 1 },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://evil.example.com/collect");
    expect(init.headers.has("X-CSRF-Token")).toBe(false);
    expect(init.credentials).toBe("same-origin");
  });

  it("does not overwrite an explicitly supplied CSRF header", async () => {
    setCsrfToken("memory.token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/candidates/me", {
      method: "PATCH",
      headers: { "X-CSRF-Token": "explicit.token" },
      body: {},
    });

    expect(fetchMock.mock.calls[0][1].headers.get("X-CSRF-Token")).toBe(
      "explicit.token"
    );
  });

  it("bootstraps before a mutation when no token is available", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { csrf_token: "boot.token" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/candidates/me", { method: "PATCH", body: {} });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/csrf");
    expect(fetchMock.mock.calls[1][1].headers.get("X-CSRF-Token")).toBe(
      "boot.token"
    );
  });

  it("does not send a mutation when bootstrap fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "unavailable" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiFetch("/candidates/me", { method: "POST", body: {} })
    ).rejects.toBeInstanceOf(ApiRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recovers once from a stale CSRF token", async () => {
    setCsrfToken("stale.token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: "CSRF token missing or invalid" }, 403)
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { csrf_token: "fresh.token" } })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiFetch("/candidates/me", { method: "PATCH", body: {} })
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/auth/csrf");
    expect(fetchMock.mock.calls[2][1].headers.get("X-CSRF-Token")).toBe(
      "fresh.token"
    );
  });

  it("stops after one CSRF retry", async () => {
    setCsrfToken("stale.token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: "CSRF token missing or invalid" }, 403)
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { csrf_token: "fresh.token" } })
      )
      .mockResolvedValueOnce(
        jsonResponse({ message: "CSRF token missing or invalid" }, 403)
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiFetch("/candidates/me", { method: "PATCH", body: {} })
    ).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry an Origin rejection", async () => {
    setCsrfToken("token.value");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ message: "Request origin is not allowed" }, 403)
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiFetch("/candidates/me", { method: "PATCH", body: {} })
    ).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
