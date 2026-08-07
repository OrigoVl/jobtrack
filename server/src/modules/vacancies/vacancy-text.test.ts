import { describe, expect, it } from "vitest";
import { computeFit, extractMainContent, extractSalary, stripHtml, vacancyEmbeddingText } from "./vacancy-text.js";

// Trimmed-down copy of a real jobs.dou.ua vacancy page's structure: the posting lives in a
// `.l-vacancy[itemprop=description]` container, and the page also carries site nav plus "hot
// jobs"/"similar jobs" blocks advertising OTHER companies' unrelated roles. Those blocks are the
// exact reason this extractor exists — before it, their technologies (React, Angular, Python,
// SQL) were scraped into a Vue/Nuxt vacancy's tech stack.
const DOU_PAGE = `<!doctype html><html><head><title>Front-end developer | Vue.js</title></head><body>
<header><a href="/">DOU</a></header>
<nav><a href="/vacancies/?category=Java">Java</a><a href="/vacancies/?category=Python">Python</a></nav>
<div class="l-vacancy" itemprop="description">
  <div class="date">5 August 2026</div>
  <h1 class="g-h2">Front-end developer | Vue.js</h1>
  <div class="sh-info"><span class="place">Kyiv</span></div>
  <div class="b-typo vacancy-section">
    <p>We build iGaming products at King Group. Salary $2000&ndash;3000 per month.</p>
    <div><ul><li>Modern stack: Vue.js 3, Nuxt (SSR), TypeScript, SCSS, Vite</li>
    <li>Commercial experience with Vue / Nuxt is required</li></ul></div>
  </div>
</div>
<div class="b-similar"><h2>Similar jobs</h2>
  <a href="/x">Middle front-end Developer (Angular) at ULF FINANCE</a>
  <a href="/y">Full-Stack Developer (React, TypeScript, Python &amp; SQL) at Alpina Tech</a>
</div>
<footer>&copy; 2005&mdash;2026 DOU.ua</footer></body></html>`;

describe("extractMainContent", () => {
  it("keeps the posting's own container and drops the page's other-jobs blocks", () => {
    const text = stripHtml(extractMainContent(DOU_PAGE));
    expect(text).toContain("Vue.js 3, Nuxt (SSR), TypeScript, SCSS, Vite");
    expect(text).toContain("Commercial experience with Vue / Nuxt");
    // The whole point: technologies belonging to OTHER companies' listings must not survive.
    expect(text).not.toMatch(/Angular|React|Python|SQL/);
    expect(text).not.toContain("Similar jobs");
  });

  it("drops site chrome even when no posting container can be identified", () => {
    const bare = `<html><body><nav>Java Python</nav><div>${"Senior Go engineer wanted. ".repeat(20)}</div><footer>React Angular</footer></body></html>`;
    const text = stripHtml(extractMainContent(bare));
    expect(text).toContain("Senior Go engineer wanted.");
    expect(text).not.toMatch(/Java|Python|React|Angular/);
  });

  it("handles a container nested inside same-tag elements without cutting it short", () => {
    const nested = `<html><body><main><div><div>${"Deep nested posting body. ".repeat(15)}</div></div><p>Tail of the posting.</p></main></body></html>`;
    const text = stripHtml(extractMainContent(nested));
    expect(text).toContain("Deep nested posting body.");
    expect(text).toContain("Tail of the posting.");
  });

  it("ignores a container too small to be the posting and falls back to the fuller page", () => {
    const tinyMain = `<html><body><main>Home</main><div class="vacancy">${"Real posting content here. ".repeat(20)}</div></body></html>`;
    expect(stripHtml(extractMainContent(tinyMain))).toContain("Real posting content here.");
  });
});

describe("extractSalary", () => {
  it("reads a currency range off the posting text", () => {
    expect(extractSalary("Salary $2000–3000 per month")).toBe("$2000–3000");
    expect(extractSalary("We offer $90k-110k depending on level")).toBe("$90k-110k");
  });

  it("reads an amount written with a trailing currency word", () => {
    expect(extractSalary("Компенсація 80000 грн на місяць")).toBe("80000 грн");
  });

  it("returns empty for a posting with no explicit amount", () => {
    expect(extractSalary("Competitive salary, discussed at the interview")).toBe("");
    expect(extractSalary("")).toBe("");
    expect(extractSalary(undefined)).toBe("");
  });

  it("does not mistake an unrelated number for a salary", () => {
    expect(extractSalary("Our team has 1000+ engineers and 20+ brands")).toBe("");
  });

  it("stops the match at the last digit instead of swallowing the punctuation after it", () => {
    expect(extractSalary("Systems Analyst, $2000–3000 , remote")).toBe("$2000–3000");
    expect(extractSalary("Pay: 4 000 000 UAH. Next line")).toBe("4 000 000 UAH");
  });
});

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
