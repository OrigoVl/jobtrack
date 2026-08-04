import { describe, expect, it } from "vitest";
import { getLocale, getRequestId, runWithRequestContext } from "./request-context.js";

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
});
