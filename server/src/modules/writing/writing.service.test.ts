import { describe, expect, it } from "vitest";
import { buildOfflineCoverLetter } from "./writing.service.js";
import type { Profile } from "../../db/types.js";

const profile = (over: Partial<Profile> = {}): Profile => ({
  skills: ["TypeScript", "Node.js"],
  cvText: "",
  ...over,
});

describe("buildOfflineCoverLetter", () => {
  it("writes the letter in the app locale", () => {
    const en = buildOfflineCoverLetter(profile({ domain: "backend" }), "Plantin", "", ["Node.js"], "en");
    const uk = buildOfflineCoverLetter(profile({ domain: "backend" }), "Plantin", "", ["Node.js"], "uk");
    expect(en).toContain("Hello!");
    expect(en).toContain("Best regards");
    expect(uk).toContain("Вітаю!");
    expect(uk).toContain("З повагою");
    expect(uk).not.toMatch(/Hello|Best regards/);
  });

  it("names the company and the profile's domain", () => {
    const text = buildOfflineCoverLetter(profile({ domain: "backend" }), "Plantin", "", [], "en");
    expect(text).toContain("your backend vacancy at Plantin");
  });

  it("omits the role and company when the profile has no domain and no company was passed", () => {
    const text = buildOfflineCoverLetter(profile(), "", "", [], "en");
    // Regression: a "the role" placeholder used to render as "your the role vacancy".
    expect(text).toContain("I'm interested in your vacancy.");
    expect(text).not.toContain("the role");
  });

  it("prefers the vacancy-matched skills over the full profile skill list", () => {
    const text = buildOfflineCoverLetter(profile({ skills: ["TypeScript", "Node.js", "Redis"] }), "", "", ["Redis"], "en");
    expect(text).toContain("hands-on experience with Redis");
    expect(text).not.toContain("TypeScript");
  });

  it("caps the highlighted skills at five", () => {
    const skills = ["A", "B", "C", "D", "E", "F", "G"];
    const text = buildOfflineCoverLetter(profile({ skills }), "", "", [], "en");
    expect(text).toContain("A, B, C, D, E");
    expect(text).not.toContain("F");
  });

  it("falls back to the domain, then to a generic line, when there are no skills", () => {
    expect(buildOfflineCoverLetter(profile({ skills: [], domain: "QA" }), "", "", [], "en")).toContain("I bring a background in QA.");
    expect(buildOfflineCoverLetter(profile({ skills: [] }), "", "", [], "uk")).toContain(
      "Хочу застосувати свій досвід саме на цій позиції.",
    );
  });

  it("appends the candidate's own guidance verbatim — there's no model here to act on it", () => {
    const text = buildOfflineCoverLetter(profile(), "", "напиши українською", [], "uk");
    expect(text).toContain("\n\nнапиши українською\n\nЗ повагою");
  });
});
