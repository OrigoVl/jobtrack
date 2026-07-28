// Contract test for the graceful-fallback path: without REDIS_URL, both limiters must build and
// behave exactly as before this change (in-memory counters, no Redis dependency at all) — the
// same "offline by default" pattern already used for LLM/email/Sentry. The Redis-backed path
// itself was verified manually against a real local Redis (counters increment under the
// "rl:api:"/"rl:ai:" prefixes, exactly one key per client) — not automated here to avoid making
// the test suite depend on a live external service, consistent with how this codebase tests its
// other optional integrations (mocked/offline, never a real service in CI).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("rate-limit (no REDIS_URL configured)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("REDIS_URL", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds apiLimiter/aiLimiter as callable middleware without needing a Redis connection", async () => {
    const { apiLimiter, aiLimiter } = await import("./rate-limit.js");
    expect(typeof apiLimiter).toBe("function");
    expect(typeof aiLimiter).toBe("function");
  });

  it("lets a request through and calls next() — no Redis, no crash", async () => {
    const { apiLimiter } = await import("./rate-limit.js");
    const next = vi.fn();
    const req = { path: "/x", ip: "9.9.9.9", headers: {}, header: () => undefined, socket: {}, app: { get: () => false } };
    const res = { setHeader: vi.fn(), getHeader: vi.fn(), status: vi.fn(() => res), json: vi.fn(), end: vi.fn() };
    await apiLimiter(req as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
