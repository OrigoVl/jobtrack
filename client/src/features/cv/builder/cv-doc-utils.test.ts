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
    // Без `@page{margin:0}` Chrome/Edge малюють системний заголовок (назва документа + дата)
    // і підвал (URL + номер сторінки) на КОЖНІЙ сторінці друку — саме на це скаржився юзер
    // ("Michael Voloshin.pdf ... на кожній сторінці зверху дата і автор"). Ці елементи
    // рендеряться в полях сторінки, зарезервованих під друк, тож `margin:0` лишає для них
    // місця; додатковий відступ від краю паперу задаємо власним `padding` у body.
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
