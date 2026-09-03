// contextLogger()'s whole point is end-to-end log correlation via AsyncLocalStorage (see this
// module's own doc comment) — this proves it actually attaches reqId/userId as pino bindings
// (grep-able structured fields), not just that it runs without throwing. request-context.js is
// mocked rather than driven through a real runWithRequestContext() so each case can set
// reqId/userId independently of AsyncLocalStorage's own plumbing (already covered by
// request-context.test.ts).
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRequestId = vi.fn<() => string | undefined>();
const getContextUserId = vi.fn<() => string | undefined>();

vi.doMock("./request-context.js", () => ({ getRequestId, getContextUserId }));

describe("contextLogger()", () => {
  beforeEach(() => {
    vi.resetModules();
    getRequestId.mockReset();
    getContextUserId.mockReset();
  });

  it("returns the plain base logger (no bindings) outside any request context", async () => {
    getRequestId.mockReturnValue(undefined);
    getContextUserId.mockReturnValue(undefined);
    const { contextLogger } = await import("./logger.js");

    expect(contextLogger().bindings()).toEqual({});
  });

  it("attaches reqId once inside a request, before authed() has resolved a userId", async () => {
    getRequestId.mockReturnValue("req-123");
    getContextUserId.mockReturnValue(undefined);
    const { contextLogger } = await import("./logger.js");

    expect(contextLogger().bindings()).toEqual({ reqId: "req-123" });
  });

  it("attaches both reqId and userId once core/http.ts's authed()/requireAdmin() has resolved a session", async () => {
    getRequestId.mockReturnValue("req-123");
    getContextUserId.mockReturnValue("user-1");
    const { contextLogger } = await import("./logger.js");

    expect(contextLogger().bindings()).toEqual({ reqId: "req-123", userId: "user-1" });
  });
});
