import { describe, expect, it } from "vitest";
import type { UserId } from "../db/user-id.js";
import { getContextUserId, getLocale, getRequestId, runWithRequestContext, setContextUserId } from "./request-context.js";

describe("request-context", () => {
  it("returns undefined/default-locale outside any request context", () => {
    expect(getRequestId()).toBeUndefined();
    expect(getLocale()).toBe("en");
  });

  it("exposes the reqId/locale passed to runWithRequestContext while inside it", () => {
    runWithRequestContext("req-123", "uk", () => {
      expect(getRequestId()).toBe("req-123");
      expect(getLocale()).toBe("uk");
    });
  });

  it("reverts to the outside-context defaults once the callback returns", () => {
    runWithRequestContext("req-123", "uk", () => {});
    expect(getRequestId()).toBeUndefined();
    expect(getLocale()).toBe("en");
  });

  it("keeps concurrent contexts isolated from each other (AsyncLocalStorage, not a shared global)", async () => {
    const a = runWithRequestContext("req-a", "en", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return getLocale();
    });
    const b = runWithRequestContext("req-b", "uk", async () => {
      return getLocale();
    });
    expect(await b).toBe("uk");
    expect(await a).toBe("en");
  });

  it("returns undefined for the userId outside any request context", () => {
    expect(getContextUserId()).toBeUndefined();
  });

  it("is a no-op outside any request context (boot-time code, the scheduler, tests)", () => {
    expect(() => setContextUserId("user-1" as UserId)).not.toThrow();
    expect(getContextUserId()).toBeUndefined();
  });

  it("exposes the userId set mid-request via setContextUserId, same as core/http.ts's authed() does", () => {
    runWithRequestContext("req-123", "en", () => {
      expect(getContextUserId()).toBeUndefined();
      setContextUserId("user-1" as UserId);
      expect(getContextUserId()).toBe("user-1");
    });
  });

  it("does not leak a userId set in one request context into a sibling context", () => {
    runWithRequestContext("req-a", "en", () => {
      setContextUserId("user-a" as UserId);
      expect(getContextUserId()).toBe("user-a");
    });
    runWithRequestContext("req-b", "en", () => {
      expect(getContextUserId()).toBeUndefined();
    });
  });
});
