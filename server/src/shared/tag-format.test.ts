import { describe, expect, it } from "vitest";
import { normalizeTag } from "./tag-format.js";

describe("normalizeTag", () => {
  it("resolves a known technology to its canonical TECHS casing", () => {
    expect(normalizeTag("javascript")).toBe("JavaScript");
    expect(normalizeTag("REACT")).toBe("React");
    expect(normalizeTag("node")).toBe("Node.js");
  });

  it("resolves a slash-compound TECHS entry from either half", () => {
    expect(normalizeTag("css")).toBe("HTML/CSS");
    expect(normalizeTag("html")).toBe("HTML/CSS");
  });

  it("upper-cases known abbreviations that aren't in TECHS", () => {
    expect(normalizeTag("seo")).toBe("SEO");
    expect(normalizeTag("hr")).toBe("HR");
  });

  it("title-cases arbitrary words", () => {
    expect(normalizeTag("excel")).toBe("Excel");
    expect(normalizeTag("frontend")).toBe("Frontend");
    expect(normalizeTag("Projektmanagement")).toBe("Projektmanagement");
  });

  it("title-cases multi-word tags without breaking each word", () => {
    expect(normalizeTag("PROJECT MANAGEMENT")).toBe("Project Management");
  });

  it("passes through empty input", () => {
    expect(normalizeTag("")).toBe("");
  });
});
