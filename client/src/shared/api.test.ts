// Covers the one piece of shared/api.ts that isn't already exercised indirectly through the
// query-hook tests (queries/*.test.tsx, which mock `api` entirely): what happens when the
// server says a session is no longer valid. A missed 401 here would mean a signed-out user
// silently sees a broken/blank screen instead of being sent back to /login.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

describe("req() 401 handling", () => {
  const realLocation = window.location;

  beforeEach(() => {
    // jsdom's real Location object logs "Not implemented: navigation" and doesn't update
    // synchronously when `.href` is reassigned — swapping in a plain mutable object lets the
    // test observe exactly what shared/api.ts writes, without fighting jsdom's navigation stub.
    Object.defineProperty(window, "location", { value: { ...realLocation, href: "", pathname: "/dashboard" }, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: realLocation, writable: true });
    vi.restoreAllMocks();
  });

  it("redirects to /login on a 401 from a protected page", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as Response);
    await expect(api.vacancies()).rejects.toThrow();
    expect(window.location.href).toBe("/login");
  });

  it("still surfaces the 401 as a rejected promise (callers see a real error, not silent undefined)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Not authenticated" }),
    } as Response);
    await expect(api.vacancies()).rejects.toThrow("Not authenticated");
  });

  it("does not redirect when already on a public path — avoids a redirect loop on /login itself", async () => {
    window.location.pathname = "/login";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as Response);
    await expect(api.vacancies()).rejects.toThrow();
    expect(window.location.href).toBe("");
  });

  it("a successful response never triggers a redirect", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
    await expect(api.vacancies()).resolves.toEqual([]);
    expect(window.location.href).toBe("");
  });
});
