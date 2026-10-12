import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it.each([["1500", 1500], ["0", 30000], ["-1", 30000], ["oops", 30000], ["Infinity", 30000], ["2147483648", 30000]])("configuración %s produce plazo %s", async (configured, expected) => {
  vi.resetModules(); vi.stubEnv("VITE_REQUEST_TIMEOUT_MS", configured);
  expect((await import("./requestLifetime")).REQUEST_TIMEOUT_MS).toBe(expected);
});
