import { afterEach, describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import type { Vacancy } from "../../shared/types";
import { exportPdf, vacancyToText } from "./cv-shared";

// Only ever called for the one missing-position fallback key — returning the key itself keeps the
// assertions readable without standing up a real i18next instance.
const t = ((key: string) => key) as unknown as TFunction<["cv", "common"]>;

const VACANCY: Vacancy = {
  id: 1,
  company: "Acme",
  position: "Frontend Developer",
  level: "Senior",
  stack: ["React", "TypeScript"],
  notes: "Remote-friendly",
} as Vacancy;

describe("vacancyToText", () => {
  it("puts position and company on the headline, then level/stack/notes on their own lines", () => {
    expect(vacancyToText(VACANCY, t)).toBe("Frontend Developer — Acme\nLevel: Senior\nStack: React, TypeScript\nRemote-friendly");
  });

  it("omits every field the vacancy doesn't have, without leaving blank lines behind", () => {
    // This text goes straight into an LLM prompt: a dangling "Level: " or an empty line reads as
    // missing information rather than as a field that was simply never filled in.
    const sparse = { ...VACANCY, company: "", level: "", stack: [], notes: "" } as Vacancy;
    expect(vacancyToText(sparse, t)).toBe("Frontend Developer");
  });

  it("falls back to a label rather than emitting an empty headline when the position is missing", () => {
    const noPosition = { ...VACANCY, position: "", company: "Acme", level: "", stack: [], notes: "" } as Vacancy;
    expect(vacancyToText(noPosition, t)).toBe("builder.vacancyMenu.fallback — Acme");
  });
});

describe("exportPdf", () => {
  afterEach(() => vi.restoreAllMocks());

  function openStub() {
    const write = vi.fn();
    const win = { document: { write, close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    return { win, write };
  }

  it("strips the light markdown an LLM-generated letter may contain", () => {
    const { write } = openStub();
    exportPdf("Cover Letter", "## Greeting\nI am **very** interested");
    const html = write.mock.calls[0]![0] as string;
    // The print output is plain text inside a <pre>, so literal ** and # would end up on paper.
    expect(html).toContain("Greeting");
    expect(html).toContain("I am very interested");
    expect(html).not.toContain("**");
    expect(html).not.toContain("## ");
  });

  it("escapes HTML in both the title and the body instead of injecting it into the print window", () => {
    const { write } = openStub();
    exportPdf("<img src=x onerror=alert(1)>", "1 < 2 & 3 > 2 <script>alert(1)</script>");
    const html = write.mock.calls[0]![0] as string;
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("1 &lt; 2 &amp; 3 &gt; 2");
  });

  it("warns instead of throwing when the popup is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    expect(() => exportPdf("Cover Letter", "body")).not.toThrow();
    expect(alertSpy).toHaveBeenCalledOnce();
  });

  it("prints only after the document is closed and focused, so the dialog has real content", () => {
    vi.useFakeTimers();
    const { win } = openStub();
    exportPdf("Cover Letter", "body");
    expect(win.print).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(win.document.close).toHaveBeenCalledBefore(win.print);
    expect(win.print).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
