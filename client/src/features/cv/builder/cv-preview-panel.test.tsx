import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { CvDoc, CvTheme } from "../../../shared/types";
import { buildCvDocument } from "./cv-doc-utils";
import { CvPreviewPanel } from "./cv-preview-panel";

const DOC: CvDoc = {
  name: "Michael Voloshyn",
  title: "Full-Stack Developer",
  contact: "michael@example.com",
  summary: "Summary",
  skills: ["TypeScript"],
  experience: [{ role: "Dev", company: "Acme", period: "2024", bullets: ["Shipped a thing"] }],
  education: [],
  projects: [],
  theme: { template: "classic", accent: "#4f46e5", font: "sans", scale: 1 },
};

const withTheme = (patch: Partial<CvTheme>): CvDoc => ({ ...DOC, theme: { ...DOC.theme!, ...patch } });

/** The stylesheet the preview document is actually rendering with, from whichever path applyCvCss
 * took — a constructed sheet where available, its `<style>` fallback otherwise (jsdom). */
function appliedCss(frame: HTMLIFrameElement): string {
  const frameDoc = frame.contentDocument!;
  const adopted = frameDoc.adoptedStyleSheets as CSSStyleSheet[] | undefined;
  if (adopted?.length)
    return Array.from(adopted[0]!.cssRules ?? [])
      .map((r) => r.cssText)
      .join("");
  return Array.from(frameDoc.head.querySelectorAll("style"))
    .map((s) => s.textContent)
    .join("");
}

beforeAll(() => {
  // Not implemented by jsdom; the preview observes its viewport to compute the scale factor.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

describe("CvPreviewPanel", () => {
  it("restyles the preview when only the stylesheet changed, not the markup", async () => {
    // The regression this guards: CSS used to be applied ONLY from the iframe's onLoad, which
    // fires just when `srcDoc` changes. Classic/minimal/timeline generate byte-identical markup
    // and differ purely in CSS, so switching between them left the preview on the old stylesheet
    // — the template visibly did not change. Same for the accent/font/scale controls.
    const { container, rerender } = render(<CvPreviewPanel doc={DOC} onExport={() => {}} />);
    const frame = container.querySelector("iframe")!;
    await waitFor(() => expect(appliedCss(frame)).toContain("#4f46e5"));

    const minimal = withTheme({ template: "minimal" });
    // Precondition of the whole bug — if this ever stops holding, the onLoad path would have
    // covered the switch on its own and this test would pass for the wrong reason.
    expect(buildCvDocument(minimal).html).toBe(buildCvDocument(DOC).html);

    rerender(<CvPreviewPanel doc={minimal} onExport={() => {}} />);
    await waitFor(() => expect(appliedCss(frame)).toContain(buildCvDocument(minimal).css));
  });

  it("restyles the preview when the accent color changes", async () => {
    const { container, rerender } = render(<CvPreviewPanel doc={DOC} onExport={() => {}} />);
    const frame = container.querySelector("iframe")!;
    await waitFor(() => expect(appliedCss(frame)).toContain("#4f46e5"));

    rerender(<CvPreviewPanel doc={withTheme({ accent: "#b91c1c" })} onExport={() => {}} />);
    await waitFor(() => expect(appliedCss(frame)).toContain("#b91c1c"));
    expect(appliedCss(frame)).not.toContain("#4f46e5");
  });

  it("applies the stylesheet once per document rather than stacking a <style> per edit", async () => {
    // applyCvCss's fallback path now reuses its element — without that, the accent/scale controls
    // (which fire on every drag step) would append a fresh <style> each time.
    const { container, rerender } = render(<CvPreviewPanel doc={DOC} onExport={() => {}} />);
    const frame = container.querySelector("iframe")!;
    await waitFor(() => expect(appliedCss(frame)).toContain("#4f46e5"));
    for (const accent of ["#b91c1c", "#0f766e", "#7e22ce"]) {
      rerender(<CvPreviewPanel doc={withTheme({ accent })} onExport={() => {}} />);
      await waitFor(() => expect(appliedCss(frame)).toContain(accent));
    }
    const sheets = frame.contentDocument!.adoptedStyleSheets?.length || frame.contentDocument!.head.querySelectorAll("style").length;
    expect(sheets).toBe(1);
  });
});
