import { describe, expect, it } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumeric runs with a single dash", () => {
    expect(slugify("Next.js")).toBe("next-js");
    expect(slugify("Node.js / Express")).toBe("node-js-express");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("  React  ")).toBe("react");
    expect(slugify("---AWS---")).toBe("aws");
  });

  it("collapses multiple separators into one dash", () => {
    expect(slugify("C++   /   C#")).toBe("c-c");
  });

  it("returns an empty string for input with no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});
