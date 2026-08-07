import type { TFunction } from "i18next";
import type { Vacancy } from "../../shared/types";

/** Composes vacancy text from fields already saved in the tracker (position/company/level/stack/notes) —
 * the same data set already shown in the vacancy table, assembled into one block for the LLM prompt.
 * Lives here rather than in cv.tsx because both the CV review page and the Cover letter page
 * (cover-letter.tsx, split out of cv.tsx when the CV pages became tabs of one section) need it. */
export function vacancyToText(v: Vacancy, t: TFunction<["cv", "common"]>): string {
  return [
    `${v.position || t("builder.vacancyMenu.fallback")}${v.company ? ` — ${v.company}` : ""}`,
    v.level ? `Level: ${v.level}` : "",
    v.stack.length ? `Stack: ${v.stack.join(", ")}` : "",
    v.notes,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Export text to PDF via the browser's print dialog (Save as PDF). Strips the light markdown
 * (**bold**, #headings) that LLM-generated text (e.g. the cover letter) may contain — the print
 * output is plain text via <pre>, so literal asterisks/hashes would otherwise show up on paper. */
export function exportPdf(title: string, body: string): void {
  const plain = body.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,4}\s+/gm, "");
  const w = window.open("", "_blank");
  if (!w) {
    alert("Allow pop-ups to export the PDF.");
    return;
  }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<style>body{font-family:Inter,system-ui,-apple-system,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.6}` +
      `h1{font-size:22px;margin:0 0 16px}pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:14px}` +
      // @page{margin:0} removes the browser's print header/footer (date, title,
      // page number) — see the detailed comment next to the same property in cv-doc-utils.ts.
      `@page{margin:0}@media print{body{margin:0;padding:14mm 12mm}}</style></head><body><h1>${esc(title)}</h1><pre>${esc(plain)}</pre></body></html>`,
  );
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}
