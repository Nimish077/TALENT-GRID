import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";

// No real network in tests: any unstubbed request fails like an offline server.
// Tests that need a response stub fetch themselves.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network disabled in tests")));
});
