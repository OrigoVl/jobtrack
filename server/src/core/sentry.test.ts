// Sentry is optional (no SENTRY_DSN -> fully disabled, see this module's own top comment) and,
// per this repo's PII conventions, must only ever attach a bare userId to an event — never an
// email/name (env.sentry's sendDefaultPii: false, plus scrubPii()'s stripping of the request
// body/cookies/headers). vi.resetModules() + a fresh dynamic import per test is required because
// Sentry.init() runs as a module-load side effect keyed off env.sentry.isAvailable (this module's
// own doc comment on why), not something callable on demand.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setUser = vi.fn();

vi.doMock("@sentry/node", () => ({
  init: vi.fn(),
  setUser,
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
}));

describe("core/sentry.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    setUser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("setSentryUser(): forwards ONLY the bare id when Sentry is configured — never an email/name", async () => {
    vi.stubEnv("SENTRY_DSN", "https://example.invalid/1");
    const { setSentryUser } = await import("./sentry.js");

    setSentryUser("user-1");

    expect(setUser).toHaveBeenCalledTimes(1);
    expect(setUser).toHaveBeenCalledWith({ id: "user-1" });
  });

  it("setSentryUser(): is a no-op when SENTRY_DSN isn't configured (no key, offline by default)", async () => {
    vi.stubEnv("SENTRY_DSN", undefined);
    const { setSentryUser } = await import("./sentry.js");

    setSentryUser("user-1");

    expect(setUser).not.toHaveBeenCalled();
  });
});
