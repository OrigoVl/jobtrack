// authed()/requireAdmin() are the ONLY place a session is read for authorization (see this
// module's own doc comments) — this test proves the two side effects that ride along with that
// resolution: setContextUserId() (so contextLogger()'s structured logs can be correlated with a
// user, core/logger.ts) and setSentryUser() (so Sentry events are attributable to an account,
// core/sentry.ts). `../auth/auth.js` is dynamic-imported inside getSession() specifically so
// this file's own import doesn't open a real Postgres connection (see http.ts's doc comment on
// that lazy import) — mocked here via vi.doMock() before the dynamic `import("./http.js")` below,
// same pattern as modules/route-order.test.ts's stub of db/client.js.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const getSession = vi.fn();
const setContextUserId = vi.fn();
const setSentryUser = vi.fn();

vi.doMock("../auth/auth.js", () => ({ auth: { api: { getSession } } }));
vi.doMock("better-auth/node", () => ({ fromNodeHeaders: vi.fn(() => new Headers()) }));
vi.doMock("./request-context.js", () => ({ setContextUserId }));
vi.doMock("./sentry.js", () => ({ setSentryUser }));

function fakeReqRes() {
  const req = { headers: {} } as Request;
  const res = {} as Response;
  return { req, res };
}

// asyncHandler's returned middleware (`function wrapped(req, res, next)`) fires-and-forgets the
// inner async handler (`Promise.resolve(fn(...)).catch(next)`, never returned/awaited) — exactly
// so Express's synchronous middleware signature works with an async handler. A test driving it
// therefore can't just `await middleware(...)`; it has to wait for one of the two mocks the
// wrapped handler is guaranteed to call at the end of its microtask chain (the inner `fn`, or
// `next` on a thrown HttpError) via `vi.waitFor` — a fixed-delay sleep here was flaky (the
// wrapped handler's chain can legitimately take more than one macrotask tick under load).
async function settled(spy: ReturnType<typeof vi.fn>): Promise<void> {
  await vi.waitFor(() => expect(spy).toHaveBeenCalled());
}

describe("authed()/requireAdmin() — session-resolution side effects", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    setContextUserId.mockReset();
    setSentryUser.mockReset();
  });

  it("authed(): tags the request context and Sentry with the resolved userId before calling the handler", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    const { authed } = await import("./http.js");
    const handler = vi.fn().mockResolvedValue(undefined);
    const middleware = authed(handler);
    const { req, res } = fakeReqRes();
    const next = vi.fn();

    middleware(req, res, next);
    await settled(handler);

    expect(setContextUserId).toHaveBeenCalledWith("user-1");
    expect(setSentryUser).toHaveBeenCalledWith("user-1");
    expect(handler).toHaveBeenCalledWith("user-1", req, res);
    expect(next).not.toHaveBeenCalled();
  });

  it("authed(): does not touch the request context or Sentry when there is no session (401)", async () => {
    getSession.mockResolvedValue(null);
    const { authed } = await import("./http.js");
    const handler = vi.fn();
    const middleware = authed(handler);
    const { req, res } = fakeReqRes();
    const next = vi.fn();

    middleware(req, res, next);
    await settled(next);

    expect(setContextUserId).not.toHaveBeenCalled();
    expect(setSentryUser).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("requireAdmin(): tags the request context and Sentry with the resolved userId for an admin session", async () => {
    getSession.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    const { requireAdmin } = await import("./http.js");
    const handler = vi.fn().mockResolvedValue(undefined);
    const middleware = requireAdmin(handler);
    const { req, res } = fakeReqRes();
    const next = vi.fn();

    middleware(req, res, next);
    await settled(handler);

    expect(setContextUserId).toHaveBeenCalledWith("admin-1");
    expect(setSentryUser).toHaveBeenCalledWith("admin-1");
    expect(handler).toHaveBeenCalledWith("admin-1", req, res);
  });

  it("requireAdmin(): does not touch the request context or Sentry for a non-admin session (403)", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    const { requireAdmin } = await import("./http.js");
    const handler = vi.fn();
    const middleware = requireAdmin(handler);
    const { req, res } = fakeReqRes();
    const next = vi.fn();

    middleware(req, res, next);
    await settled(next);

    expect(setContextUserId).not.toHaveBeenCalled();
    expect(setSentryUser).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });
});
