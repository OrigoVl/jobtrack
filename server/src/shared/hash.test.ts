import { describe, expect, it } from "vitest";
import { hashString } from "./hash.js";

describe("hashString", () => {
  it("is deterministic for the same input", () => {
    expect(hashString("react developer")).toBe(hashString("react developer"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashString("react")).not.toBe(hashString("vue"));
  });

  it("returns a 64-character lowercase hex string (SHA-256)", () => {
    const h = hashString("some arbitrary cache key");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles empty strings and unicode without throwing", () => {
    expect(() => hashString("")).not.toThrow();
    expect(() => hashString("Full-Stack developer 🚀")).not.toThrow();
  });
});
