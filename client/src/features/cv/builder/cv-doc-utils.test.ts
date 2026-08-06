import { describe, expect, it } from "vitest";
import type { CvDoc, CvTheme } from "../../../shared/types";
import { buildCvHtml } from "./cv-doc-utils";

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

describe("buildCvHtml", () => {
  it("disables the browser print header/footer (date, title, URL, page number)", () => {
    // Without `@page{margin:0}` Chrome/Edge draw a system header (document title + date) and
    // footer (URL + page number) on EVERY printed page — exactly what a user complained about
    // ("Michael Voloshin.pdf ... date and author at the top of every page"). These elements
    // render in the page margins reserved for printing, so `margin:0` leaves no room for them;
    // we set our own spacing from the paper edge via `padding` on body instead.
    const html = buildCvHtml(BASE_DOC);
    expect(html).toContain("@page{margin:0}");
    expect(html).toMatch(/@media print\{body\{margin:0;max-width:none;padding:14mm 12mm\}\}/);
  });

  it("escapes HTML-sensitive characters in user input", () => {
    const html = buildCvHtml({ ...BASE_DOC, name: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("uses the CV owner's name as the document title (for the default 'Save as PDF' filename)", () => {
    const html = buildCvHtml(BASE_DOC);
    expect(html).toContain("<title>Michael Voloshyn</title>");
  });

  it("renders every template variant without throwing, each producing non-empty markup", () => {
    const templates: CvTheme["template"][] = ["classic", "compact", "academic", "twocol", "minimal", "sidebar", "timeline"];
    for (const template of templates) {
      const html = buildCvHtml({ ...BASE_DOC, theme: { template, accent: "#4f46e5", font: "sans", scale: 1 } });
      expect(html).toContain(BASE_DOC.name);
    }
  });

  it("tags sections and each experience entry with data-section, for the interactive preview → editor click sync", () => {
    const html = buildCvHtml({
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
    const html = buildCvHtml(WITH_NEW_SECTIONS);
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
      const html = buildCvHtml({ ...WITH_NEW_SECTIONS, theme: { template, accent: "#4f46e5", font: "sans", scale: 1 } });
      expect(html).toContain("Employee of the Year");
    }
  });

  it("uses English section headers for a Latin/English CV", () => {
    const html = buildCvHtml(WITH_NEW_SECTIONS);
    expect(html).toContain("<h2>Awards</h2>");
    expect(html).toContain("<h2>Publications</h2>");
    expect(html).toContain("<h2>Volunteer Experience</h2>");
    expect(html).toContain("<h2>References</h2>");
    expect(html).toContain('<html lang="en">');
  });

  it("switches section headers to Ukrainian for a majority-Cyrillic CV, without an explicit language field", () => {
    const html = buildCvHtml({
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
