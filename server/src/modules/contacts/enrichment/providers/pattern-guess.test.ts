// The keyless fallback carries the whole feature when no provider key is configured, so its
// "nothing to guess against" branches matter as much as the happy path — each one must still hand
// back a usable row rather than an empty result.
import { describe, expect, it } from "vitest";
import { PATTERN_GUESS } from "./pattern-guess.js";
import type { EnrichmentQuery } from "../enrichment-providers.js";

function query(overrides: Partial<EnrichmentQuery> = {}): EnrichmentQuery {
  return { companyName: "Acme", domain: "acme.com", titles: [], personName: "", limit: 10, ...overrides };
}

describe("PATTERN_GUESS.search()", () => {
  it("returns up to 3 distinct guessed addresses for a named person at a known domain", async () => {
    const results = await PATTERN_GUESS.search(query({ personName: "Jane Doe" }));

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.email)).toEqual(["jane.doe@acme.com", "jane@acme.com", "jdoe@acme.com"]);
    expect(results.every((r) => r.name === "Jane Doe" && r.emailStatus === "guessed")).toBe(true);
  });

  it("still returns a LinkedIn lead for a named person when the domain is unknown", async () => {
    const results = await PATTERN_GUESS.search(query({ domain: "", personName: "Jane Doe" }));

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("Jane Doe");
    expect(results[0]!.email).toBe("");
    expect(results[0]!.linkedinUrl).toContain(encodeURIComponent("Jane Doe Acme"));
  });

  it("falls back to a recruiter search link when only a company name is given", async () => {
    const results = await PATTERN_GUESS.search(query({ domain: "" }));

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("");
    expect(results[0]!.linkedinUrl).toContain(encodeURIComponent("recruiter Acme"));
  });

  it("costs nothing and is always available", () => {
    expect(PATTERN_GUESS.creditsPerCall).toBe(0);
    expect(PATTERN_GUESS.isAvailable()).toBe(true);
  });
});
