import { describe, expect, it } from "vitest";
import { computeFit, stripHtml, vacancyEmbeddingText } from "./vacancy-text.js";

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
    // Without a demand map, 1 match / 1 gap is exactly 50/50 (med); with a demand map, React
    // (a common, high-demand skill) outweighs the niche COBOL gap — the score becomes higher (high).
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

describe("vacancyEmbeddingText", () => {
  it("combines position, company, level, stack, and notes into one blob", () => {
    const text = vacancyEmbeddingText({
      position: "Backend Engineer",
      company: "Acme",
      level: "Senior",
      stack: ["Node.js", "PostgreSQL"],
      notes: "Fully remote, EU timezone.",
    });
    expect(text).toBe("Backend Engineer at Acme. Level: Senior. Stack: Node.js, PostgreSQL. Fully remote, EU timezone.");
  });

  it("omits a section entirely when its field is empty, rather than leaving a blank placeholder", () => {
    const text = vacancyEmbeddingText({ position: "Backend Engineer", company: "Acme", level: "", stack: [], notes: "" });
    expect(text).toBe("Backend Engineer at Acme.");
    expect(text).not.toMatch(/Level:|Stack:/);
  });

  it("returns an empty string for a vacancy with no meaningful content at all", () => {
    expect(vacancyEmbeddingText({ position: "", company: "", level: "", stack: [], notes: "" })).toBe("");
  });

  it("falls back to a placeholder company/position rather than an empty 'at' clause when only one side is known", () => {
    expect(vacancyEmbeddingText({ position: "Backend Engineer", company: "", level: "", stack: [], notes: "" })).toBe(
      "Backend Engineer at an unknown company.",
    );
    expect(vacancyEmbeddingText({ position: "", company: "Acme", level: "", stack: [], notes: "" })).toBe("Unknown position at Acme.");
  });
});
