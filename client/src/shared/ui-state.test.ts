import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUi } from "./ui-state";

describe("useUi", () => {
  // Each test uses its own key — the underlying store is a module-level singleton (by design,
  // see ui-state.ts), so reusing a key across tests would leak state between them.
  it("returns the initial value until set() is called", () => {
    const { result } = renderHook(() => useUi("test.a", "general"));
    expect(result.current[0]).toBe("general");
  });

  it("returns the newly-set value after set() — including falsy values (0, '', false)", () => {
    const { result } = renderHook(() => useUi("test.b", "general"));
    act(() => result.current[1]("skills"));
    expect(result.current[0]).toBe("skills");
  });

  // Regression: an exclusive accordion (CV Builder) represents "nothing open" as `null`.
  // `uiStore`'s getSnapshot used to be `get(key) ?? initial`, which coalesces an explicitly
  // stored `null`/`undefined`/`false`/`0`/`""` straight back to `initial` on every read — so
  // "close the only open section" was silently impossible: the very next render snapped the
  // value back to the initial section instead of "none open".
  it("keeps an explicitly-set null instead of snapping back to initial (e.g. closing an exclusive accordion)", () => {
    const { result } = renderHook(() => useUi<string | null>("test.c", "general"));
    act(() => result.current[1](null));
    expect(result.current[0]).toBeNull();
  });

  it("keeps other explicitly-set falsy values (false, 0, '') instead of snapping back to initial", () => {
    const bools = renderHook(() => useUi("test.d", true));
    act(() => bools.result.current[1](false));
    expect(bools.result.current[0]).toBe(false);

    const numbers = renderHook(() => useUi("test.e", 5));
    act(() => numbers.result.current[1](0));
    expect(numbers.result.current[0]).toBe(0);
  });
});
