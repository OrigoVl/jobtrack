import { describe, expect, it } from "vitest";
import { hashString } from "./hash.js";

describe("hashString", () => {
  it("is deterministic for the same input", () => {
    expect(hashString("react developer")).toBe(hashString("react developer"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashString("react")).not.toBe(hashString("vue"));
  });

  it("returns a non-negative numeric string", () => {
    const h = hashString("some arbitrary cache key");
    expect(h).toMatch(/^\d+$/);
    expect(Number(h)).toBeGreaterThanOrEqual(0);
  });

  it("handles empty strings and unicode without throwing", () => {
    expect(() => hashString("")).not.toThrow();
    expect(() => hashString("Full-Stack developer 🚀")).not.toThrow();
  });
});
