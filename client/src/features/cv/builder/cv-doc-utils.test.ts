import { describe, expect, it } from "vitest";
import type { CvDoc, CvTheme } from "../../../shared/types";
import { DEFAULT_ORDER, DEFAULT_THEME, buildCvDocument, cvDocToText, effectiveSkillsStyle, themeOf } from "./cv-doc-utils";

const BASE_DOC: CvDoc = {
  name: "Michael Voloshyn",
  title: "Full-Stack Developer",
  contact: "michael@example.com",
  summary: "Summary",
  skills: ["TypeScript"],
  experience: [],
  education: [],
  projects: [],
};

describe("buildCvDocument", () => {
  it("disables the browser print header/footer (date, title, URL, page number)", () => {
    // Without `@page{margin:0}` Chrome/Edge draw a system header (document title + date) and
    // footer (URL + page number) on EVERY printed page — exactly what a user complained about
    // ("Michael Voloshin.pdf ... date and author at the top of every page"). These elements
    // render in the page margins reserved for printing, so `margin:0` leaves no room for them;
    // we set our own spacing from the paper edge via `padding` on body instead.
    const { css } = buildCvDocument(BASE_DOC);
    expect(css).toContain("@page{margin:0}");
    expect(css).toMatch(/@media print\{body\{margin:0;max-width:none;padding:14mm 12mm\}\}/);
  });

  it("keeps the stylesheet OUT of the markup, so the app's CSP can't strip it", () => {
    // Every consumer renders this into a srcdoc iframe or a window.open() popup, and those
    // inherit the app's CSP — whose style-src-elem has no 'unsafe-inline' (server/src/app.ts).
    // An inline <style> here is silently dropped in production and the CV renders as unstyled
    // Times New Roman (the preview, the public share page and the exported PDF all did). The
    // CSS is applied via applyCvCss/CSSOM instead; putting it back inline would regress that.
    const { html, css } = buildCvDocument(BASE_DOC);
    expect(html).not.toContain("<style");
    expect(css).toContain("body{font-family:");
  });

  describe("skills rendering", () => {
    const THREE_SKILLS: CvDoc = { ...BASE_DOC, skills: ["TypeScript", "Node.js", "SQL"] };
    const withTheme = (theme: Partial<CvTheme>) => buildCvDocument({ ...THREE_SKILLS, theme: { ...DEFAULT_THEME, ...theme } });

    it("renders them in the doc's own order — the editor's reordering is what decides the CV's order", () => {
      const { html } = buildCvDocument({ ...THREE_SKILLS, skills: ["SQL", "TypeScript", "Node.js"] });
      expect(html.indexOf("SQL")).toBeLessThan(html.indexOf("TypeScript"));
      expect(html.indexOf("TypeScript")).toBeLessThan(html.indexOf("Node.js"));
    });

    it("keeps each template's established default under 'auto', so no existing CV changes look", () => {
      // The two text-dense templates always ran the skills as one inline line, the rest as chips.
      expect(effectiveSkillsStyle({ ...DEFAULT_THEME, template: "compact" })).toBe("inline");
      expect(effectiveSkillsStyle({ ...DEFAULT_THEME, template: "academic" })).toBe("inline");
      expect(effectiveSkillsStyle({ ...DEFAULT_THEME, template: "classic" })).toBe("chips");
      // A doc saved before the setting existed has no `skillsStyle` key at all.
      expect(effectiveSkillsStyle({ ...DEFAULT_THEME, skillsStyle: undefined, template: "sidebar" })).toBe("chips");
    });

    it("lets an explicit style override the template default in both directions", () => {
      expect(withTheme({ template: "compact", skillsStyle: "chips" }).html).toContain('<span class="chip">TypeScript</span>');
      expect(withTheme({ template: "classic", skillsStyle: "inline" }).html).toContain("<p>TypeScript · Node.js · SQL</p>");
      expect(withTheme({ template: "classic", skillsStyle: "list" }).html).toContain('<ul class="skill-list"><li>TypeScript</li>');
    });

    it("reproduces the pre-setting chip look by default, and applies shape/fill when chosen", () => {
      // Defaults: 6px corners, accent-tinted background — exactly what chips looked like before
      // any of this was configurable.
      expect(withTheme({ accent: "#4f46e5" }).css).toContain(
        "background:#4f46e514;color:#4f46e5;border:1px solid #4f46e533;border-radius:6px",
      );
      expect(withTheme({ skillChipShape: "pill" }).css).toContain("border-radius:999px");
      expect(withTheme({ skillChipShape: "square" }).css).toContain("border-radius:0");
      expect(withTheme({ accent: "#4f46e5", skillChipFill: "solid" }).css).toContain("background:#4f46e5;color:#fff");
      expect(withTheme({ accent: "#4f46e5", skillChipFill: "outline" }).css).toContain("background:transparent;color:#4f46e5");
    });

    it("stops the minimal template greying out a fill the user explicitly picked", () => {
      // Minimal quiets the accent down to greys on purpose — but only as a default. Choosing a
      // fill is a deliberate decision, and used to be silently overridden by that rule.
      expect(withTheme({ template: "minimal" }).css).toContain(".chip{background:#f8fafc");
      expect(withTheme({ template: "minimal", skillChipFill: "solid" }).css).not.toContain(".chip{background:#f8fafc");
    });
  });

  it("escapes HTML-sensitive characters in user input", () => {
    const { html } = buildCvDocument({ ...BASE_DOC, name: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("uses the CV owner's name as the document title (for the default 'Save as PDF' filename)", () => {
    const { html } = buildCvDocument(BASE_DOC);
    expect(html).toContain("<title>Michael Voloshyn</title>");
  });

  it("renders every template variant without throwing, each producing non-empty markup", () => {
    const templates: CvTheme["template"][] = ["classic", "compact", "academic", "twocol", "minimal", "sidebar", "timeline"];
    for (const template of templates) {
      const { html } = buildCvDocument({ ...BASE_DOC, theme: { template, accent: "#4f46e5", font: "sans", scale: 1 } });
      expect(html).toContain(BASE_DOC.name);
    }
  });

  it("tags sections and each experience entry with data-section, for the interactive preview → editor click sync", () => {
    const { html } = buildCvDocument({
      ...BASE_DOC,
      experience: [
        { role: "Dev", company: "Acme", period: "2022—now", bullets: ["Shipped X"] },
        { role: "Dev", company: "Beta", period: "2020—2022", bullets: [] },
      ],
    });
    expect(html).toContain('data-section="general"');
    expect(html).toContain('data-section="summary"');
    expect(html).toContain('data-section="skills"');
    expect(html).toContain('data-section="experience-0"');
    expect(html).toContain('data-section="experience-1"');
  });

  const WITH_NEW_SECTIONS: CvDoc = {
    ...BASE_DOC,
    awards: [{ title: "Employee of the Year", issuer: "Acme Corp", date: "2023" }],
    publications: [{ title: "Scaling Postgres", publisher: "Acme Blog", date: "2024", url: "acme.com/blog" }],
    volunteer: [{ role: "Mentor", organization: "Code Club", period: "2021 – 2022", description: "Taught JS basics." }],
    references: [{ name: "Jane Smith", relation: "Manager at Acme", contact: "jane@acme.com" }],
  };

  it("renders awards/publications/volunteer/references content and tags them with data-section", () => {
    const { html } = buildCvDocument(WITH_NEW_SECTIONS);
    expect(html).toContain("Employee of the Year");
    expect(html).toContain("Scaling Postgres");
    expect(html).toContain("Mentor");
    expect(html).toContain("Code Club");
    expect(html).toContain("Taught JS basics.");
    expect(html).toContain("Jane Smith");
    expect(html).toContain("Manager at Acme");
    expect(html).toContain('data-section="awards"');
    expect(html).toContain('data-section="publications"');
    expect(html).toContain('data-section="volunteer"');
    expect(html).toContain('data-section="references"');
  });

  it("renders every template variant with the new sections populated, without throwing", () => {
    const templates: CvTheme["template"][] = ["classic", "compact", "academic", "twocol", "minimal", "sidebar", "timeline"];
    for (const template of templates) {
      const { html } = buildCvDocument({ ...WITH_NEW_SECTIONS, theme: { template, accent: "#4f46e5", font: "sans", scale: 1 } });
      expect(html).toContain("Employee of the Year");
    }
  });

  it("uses English section headers for a Latin/English CV", () => {
    const { html } = buildCvDocument(WITH_NEW_SECTIONS);
    expect(html).toContain("<h2>Awards</h2>");
    expect(html).toContain("<h2>Publications</h2>");
    expect(html).toContain("<h2>Volunteer Experience</h2>");
    expect(html).toContain("<h2>References</h2>");
    expect(html).toContain('<html lang="en">');
  });

  it("switches section headers to Ukrainian for a majority-Cyrillic CV, without an explicit language field", () => {
    const { html } = buildCvDocument({
      ...BASE_DOC,
      title: "Розробник",
      summary: "Досвідчений розробник з великим досвідом роботи над складними проєктами.",
      awards: [{ title: "Найкращий співробітник року", issuer: "Acme Corp", date: "2023" }],
    });
    expect(html).toContain("<h2>Про мене</h2>");
    expect(html).toContain("<h2>Навички</h2>");
    expect(html).toContain("<h2>Нагороди</h2>");
    expect(html).toContain('<html lang="uk">');
  });
});

describe("themeOf", () => {
  it("fills every unset theme field from DEFAULT_THEME", () => {
    expect(themeOf(BASE_DOC)).toEqual(DEFAULT_THEME);
  });

  it("lets a partially-set theme override only the fields it actually specifies", () => {
    const theme = themeOf({ ...BASE_DOC, theme: { template: "sidebar", accent: "#0f766e" } as CvTheme });
    expect(theme.template).toBe("sidebar");
    expect(theme.accent).toBe("#0f766e");
    // Untouched fields still come from the defaults rather than becoming undefined — the whole
    // point of this helper, since every consumer (buildCvDocument, AppearancePanel) reads them
    // unconditionally and a stored doc predating a new field simply won't have it.
    expect(theme.font).toBe(DEFAULT_THEME.font);
    expect(theme.scale).toBe(DEFAULT_THEME.scale);
    expect(theme.order).toEqual(DEFAULT_ORDER);
  });
});

/**
 * `cvDocToText` is what every AI feature on this page is actually given — the review job, the
 * vacancy match and the tailor call all send its output, never the CvDoc itself. Anything it
 * silently drops is invisible to the LLM no matter how carefully the user filled it in.
 */
describe("cvDocToText", () => {
  it("includes every filled section, so nothing the user typed is hidden from the AI", () => {
    const text = cvDocToText({
      ...BASE_DOC,
      links: [{ label: "GitHub", url: "gh.com/m" }],
      skills: ["TypeScript", "Go"],
      experience: [{ role: "Dev", company: "Acme", period: "2020—now", bullets: ["Shipped a thing", ""] }],
      projects: [{ title: "Zorya", description: "Job tracker", tech: ["React"], link: "zorya.app" }],
      education: [{ school: "KPI", degree: "MSc", period: "2016—2020" }],
      certifications: [{ name: "AWS SAA", issuer: "Amazon", date: "2023" }],
      languages: [{ name: "English", level: "B2" }],
      awards: [{ title: "Best Intern", issuer: "Acme", date: "2019" }],
      publications: [{ title: "On Types", publisher: "ACM", date: "2022", url: "acm.org/x" }],
      volunteer: [{ role: "Mentor", organization: "CodeClub", period: "2021", description: "Taught JS" }],
      references: [{ name: "Ada", relation: "Manager", contact: "ada@acme.com" }],
    });
    for (const fragment of [
      "Michael Voloshyn",
      "GitHub: gh.com/m",
      "Skills: TypeScript, Go",
      "Dev — Acme (2020—now)",
      "- Shipped a thing",
      "Zorya — Job tracker — React — zorya.app",
      "MSc, KPI, 2016—2020",
      "AWS SAA, Amazon, 2023",
      "Languages: English (B2)",
      "Best Intern, Acme, 2019",
      "On Types, ACM, 2022, acm.org/x",
      "Mentor — CodeClub (2021)",
      "Ada, Manager, ada@acme.com",
    ]) {
      expect(text).toContain(fragment);
    }
  });

  it("omits empty sections entirely instead of emitting bare headings", () => {
    const text = cvDocToText({ ...BASE_DOC, skills: [], summary: "" });
    // A heading with nothing under it is noise in the prompt, and "Skills:" followed by nothing
    // reads to an LLM as "this candidate listed no skills" rather than "this wasn't filled in".
    expect(text).not.toContain("Skills:");
    expect(text).not.toContain("Profile:");
    expect(text).not.toContain("Experience:");
    expect(text).toContain("Michael Voloshyn");
  });

  it("drops entries that are blank across all their fields, and blank bullets within a kept entry", () => {
    const text = cvDocToText({
      ...BASE_DOC,
      experience: [{ role: "Dev", company: "Acme", period: "2024", bullets: ["Real bullet", "", "   "] }],
      projects: [{ title: "  ", description: "", tech: [], link: "" }],
      education: [{ school: "", degree: "", period: "" }],
      references: [{ name: "", relation: "", contact: "" }],
    });
    expect(text).toContain("- Real bullet");
    expect(text.match(/^- /gm)?.length).toBe(1);
    expect(text).not.toContain("Projects:");
    expect(text).not.toContain("Education:");
    expect(text).not.toContain("References:");
  });

  it("survives a doc missing every optional array (an older saved doc predating those sections)", () => {
    // The optional sections are `?:` on CvDoc and older persisted docs simply don't have the
    // keys — reading `.filter` off undefined here would break the AI actions for exactly the
    // long-standing accounts most likely to use them.
    const legacy = { ...BASE_DOC } as CvDoc;
    expect(() => cvDocToText(legacy)).not.toThrow();
    expect(cvDocToText(legacy)).toContain("Full-Stack Developer");
  });
});
