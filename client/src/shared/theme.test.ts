import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * theme.ts decides the value of `<html data-theme>` — every color token in index.css keys off it.
 * Two things here are easy to break and invisible until someone notices a flash of the wrong
 * theme or a switcher that only updates half the page:
 *
 *  - the bootstrap runs at IMPORT time (before React mounts), so each case below has to import
 *    the module fresh with storage/matchMedia already arranged — hence `vi.resetModules()` plus
 *    a dynamic import rather than a top-level one;
 *  - the OS preference is deliberately NOT persisted, so a later OS-level change is still picked
 *    up on the next load instead of being frozen at whatever we guessed the first time.
 */
const STORAGE_KEY = "jobtrack.theme";

function stubSystemDark(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query.includes("dark") && matches })) as unknown as typeof window.matchMedia,
  );
}

async function importTheme() {
  vi.resetModules();
  return import("./theme");
}

describe("theme bootstrap", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("applies an explicitly saved preference before React ever mounts", async () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    stubSystemDark(false);
    await importTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("follows the OS preference when nothing was ever chosen", async () => {
    stubSystemDark(true);
    await importTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    // Deliberately not written to storage — see the module's own comment.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to light when the OS preference can't be read at all", async () => {
    vi.stubGlobal("matchMedia", undefined);
    await importTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("ignores a junk stored value rather than writing it onto the document", async () => {
    localStorage.setItem(STORAGE_KEY, "solarized");
    stubSystemDark(true);
    await importTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    stubSystemDark(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("persists an explicit choice and reflects it on the document", async () => {
    const { useTheme } = await importTheme();
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("light");

    act(() => result.current[1]("dark"));

    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("notifies every mounted consumer, not just the one that made the change", async () => {
    // The switcher and design-canvas.tsx's React Flow `colorMode` are separate useTheme() calls;
    // without the module-level pub/sub, flipping the switcher would leave the canvas on the old
    // theme until something else happened to re-render it.
    const { useTheme } = await importTheme();
    const switcher = renderHook(() => useTheme());
    const canvas = renderHook(() => useTheme());

    act(() => switcher.result.current[1]("dark"));

    expect(canvas.result.current[0]).toBe("dark");
  });

  it("stops notifying a consumer once it unmounts", async () => {
    const { useTheme } = await importTheme();
    const stale = renderHook(() => useTheme());
    const live = renderHook(() => useTheme());
    stale.unmount();

    expect(() => act(() => live.result.current[1]("dark"))).not.toThrow();
    expect(live.result.current[0]).toBe("dark");
  });
});
