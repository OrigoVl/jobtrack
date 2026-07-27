import { describe, expect, it } from "vitest";
import { computeFit, stripHtml } from "./vacancy-text.js";

describe("computeFit", () => {
  it("returns high when matches clearly outweigh gaps", () => {
    expect(computeFit(["React", "TypeScript"], ["Docker"])).toBe("high");
    expect(computeFit(["React"], [])).toBe("high");
  });

  it("returns med for a roughly 50/50 split between matches and gaps", () => {
    expect(computeFit(["React"], ["Docker"])).toBe("med");
  });

  it(
    "returns low when there are zero matches, however few the gaps are — fixes the old bug where " +
      "0 matches / 2 gaps (0% fit) was misclassified as 'med'",
    () => {
      expect(computeFit([], ["Docker", "AWS"])).toBe("low");
    },
  );

  it("returns low when gaps clearly outweigh matches", () => {
    expect(computeFit([], ["Docker", "AWS", "Kubernetes"])).toBe("low");
    expect(computeFit(["React"], ["Docker", "AWS", "Kubernetes"])).toBe("low");
  });

  it("returns high for a vacancy with no detected requirements at all", () => {
    expect(computeFit([], [])).toBe("high");
  });

  it("weighs a matched skill that is in high market demand more than a missing niche one, " + "given a demand map", () => {
    const demand = { React: 20, COBOL: 1 };
    const withDemand = computeFit(["React"], ["COBOL"], demand);
    const withoutDemand = computeFit(["React"], ["COBOL"]);
    // Без мапи попиту 1 match / 1 gap — це рівно 50/50 (med); з мапою попиту React (типова,
    // високопопитна навичка) переважує нішевий COBOL-геп — оцінка стає вищою (high).
    expect(withoutDemand).toBe("med");
    expect(withDemand).toBe("high");
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
