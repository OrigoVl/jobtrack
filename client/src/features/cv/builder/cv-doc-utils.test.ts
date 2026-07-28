import { describe, expect, it } from "vitest";
import type { CvDoc } from "../../../shared/types";
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
});
