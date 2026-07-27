import { describe, expect, it } from "vitest";
import { computeFit, stripHtml } from "./vacancy-text.js";

describe("computeFit", () => {
  it("returns high when matches are at least as many as gaps", () => {
    expect(computeFit(["React", "TypeScript"], ["Docker"])).toBe("high");
    expect(computeFit(["React"], [])).toBe("high");
  });

  it("returns med when gaps outnumber matches but are still small (<=2)", () => {
    expect(computeFit([], ["Docker", "AWS"])).toBe("med");
    expect(computeFit(["React"], ["Docker", "AWS"])).toBe("med");
  });

  it("returns low when gaps outnumber matches by more than 2", () => {
    expect(computeFit([], ["Docker", "AWS", "Kubernetes"])).toBe("low");
  });

  it("returns high for a vacancy with no detected requirements at all", () => {
    expect(computeFit([], [])).toBe("high");
  });
});

describe("stripHtml", () => {
  it("removes script and style blocks entirely, including their content", () => {
    const html = "<html><head><style>.a{color:red}</style></head><body><script>alert(1)</script>Hello</body></html>";
    expect(stripHtml(html)).toBe("Hello");
  });

  it("strips tags and decodes common HTML entities", () => {
    const html = "<p>React &amp; Node</p><p>a &lt; b &gt; c</p>";
    expect(stripHtml(html)).toBe("React & Node a < b > c");
  });

  it("collapses whitespace and trims the result", () => {
    expect(stripHtml("<div>  Senior   \n\n Backend   Engineer  </div>")).toBe("Senior Backend Engineer");
  });

  it("replaces numeric HTML entities with a space", () => {
    expect(stripHtml("Node&#160;JS")).toBe("Node JS");
  });
});
