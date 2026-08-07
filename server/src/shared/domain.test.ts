import { describe, expect, it } from "vitest";
import { toDomain } from "./domain.js";

describe("toDomain()", () => {
  it("strips scheme, www, path and query from a full URL", () => {
    expect(toDomain("https://www.Acme.com/careers?x=1")).toBe("acme.com");
  });

  it("lowercases a bare host", () => {
    expect(toDomain("Acme.com")).toBe("acme.com");
  });

  it("takes the part after '@' for an email address", () => {
    expect(toDomain("hr@acme.com")).toBe("acme.com");
  });

  it("strips a http:// scheme without www", () => {
    expect(toDomain("http://acme.com/jobs")).toBe("acme.com");
  });

  it("strips a hash fragment", () => {
    expect(toDomain("acme.com#section")).toBe("acme.com");
  });

  it("strips a trailing port", () => {
    expect(toDomain("acme.com:8080")).toBe("acme.com");
  });

  it("returns '' for an empty/whitespace string", () => {
    expect(toDomain("")).toBe("");
    expect(toDomain("   ")).toBe("");
  });

  it("returns '' for text with no dot (not a plausible host)", () => {
    expect(toDomain("just some text")).toBe("");
  });

  it("returns '' for a scheme with nothing left after stripping", () => {
    expect(toDomain("https://")).toBe("");
  });

  it("returns '' for a string containing characters outside [a-z0-9.-]", () => {
    expect(toDomain("acme_corp.com")).toBe("");
    expect(toDomain("acme corp.com")).toBe("");
  });

  it("returns '' for a string over 253 chars", () => {
    const longHost = "a".repeat(250) + ".com";
    expect(toDomain(longHost)).toBe("");
  });

  it("returns '' for a leading/trailing dot or hyphen", () => {
    expect(toDomain(".acme.com")).toBe("");
    expect(toDomain("acme.com.")).toBe("");
    expect(toDomain("-acme.com")).toBe("");
  });

  it("returns '' for a non-string-ish nullish input", () => {
    expect(toDomain(null as unknown as string)).toBe("");
    expect(toDomain(undefined as unknown as string)).toBe("");
  });
});
