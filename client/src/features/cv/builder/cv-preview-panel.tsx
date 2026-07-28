import { useEffect, useRef, useState } from "react";
import { Btn, Card, Segmented } from "../../../shared/ui";
import { useUi } from "../../../shared/ui-state";
import type { CvDoc } from "../../../shared/types";
import { buildCvHtml } from "./cv-doc-utils";

// Virtual "page" width of the preview in CSS px — the same as the body max-width in buildCvHtml
// (820px of content + 2×30px padding). We render the iframe at exactly this width and scale it
// visually (CSS transform), rather than letting the browser squeeze the inner layout into a
// narrow column — otherwise the "Two columns" template would look distorted on a narrow
// sidebar instead of matching the real PDF.
const PAGE_WIDTH = 880;
// Approximate height of one A4 page in CSS px when printed (~96dpi) — just for the "how many
// pages will this be" hint, not an exact calculation: real printing removes the max-width (see
// @media print in buildCvHtml) and adds the browser's own margins, so the actual page count may differ.
const A4_PAGE_HEIGHT = 1050;

const ZOOM_OPTIONS = [
  { value: 0.8, label: "80%" },
  { value: 1, label: "100%" },
  { value: 1.25, label: "125%" },
];

/** Sections that are still empty and won't make it into the generated PDF — a quick informative hint. */
function emptySectionLabels(doc: CvDoc): string[] {
  const checks: [boolean, string][] = [
    [!doc.summary.trim(), "Profile"],
    [doc.skills.length === 0, "Skills"],
    [doc.experience.length === 0, "Experience"],
    [doc.projects.filter(Boolean).length === 0, "Projects"],
    [doc.education.filter(Boolean).length === 0, "Education"],
    [(doc.languages ?? []).filter((l) => l.name.trim()).length === 0, "Languages"],
  ];
  return checks.filter(([empty]) => empty).map(([, label]) => label);
}

/**
 * A scaled iframe preview at a fixed "page" width (PAGE_WIDTH). The inner markup always renders
 * at the same width as the real PDF — only the container itself is scaled visually (CSS
 * transform) to fit the available space (ResizeObserver) and the chosen zoom. This makes the
 * preview in a narrow sidebar look the same as it will in the PDF, rather than distorted/squeezed
 * by a narrow iframe's reflow.
 */
function ScaledFrame({
  html,
  zoom,
  maxHeight,
  onContentHeight,
}: {
  html: string;
  zoom: number;
  maxHeight: string;
  onContentHeight: (h: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(PAGE_WIDTH);
  const [contentHeight, setContentHeight] = useState(1200);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = (containerWidth / PAGE_WIDTH) * zoom;
  return (
    <div ref={viewportRef} className="overflow-auto bg-slate-100" style={{ maxHeight }}>
      <div className="flex justify-center py-4">
        <div style={{ width: PAGE_WIDTH * scale, height: contentHeight * scale, overflow: "hidden" }} className="shadow-md shrink-0">
          <iframe
            title="CV preview"
            srcDoc={html}
            onLoad={(e) => {
              const h = e.currentTarget.contentDocument?.documentElement.scrollHeight ?? 1200;
              setContentHeight(h);
              onContentHeight(h);
            }}
            style={{
              width: PAGE_WIDTH,
              height: contentHeight,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="bg-white"
          />
        </div>
      </div>
    </div>
  );
}

/** Preview panel header: page-count badge, zoom, and actions — shared by the inline card and the fullscreen modal. */
function PreviewToolbar({
  pages,
  zoom,
  onZoomChange,
  onExport,
  onToggleFullscreen,
  fullscreenLabel,
}: {
  pages: number;
  zoom: number;
  onZoomChange: (z: number) => void;
  onExport: () => void;
  onToggleFullscreen?: () => void;
  fullscreenLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-100 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Preview (as in PDF)</span>
        <span
          title="Approximate number of pages when printed to PDF — actual printing may differ slightly"
          className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
            pages > 1 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {pages > 1 ? `⚠ ~${pages} pg.` : "✓ 1 pg."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Segmented value={zoom} onChange={onZoomChange} options={ZOOM_OPTIONS} size="sm" />
        {onToggleFullscreen && (
          <Btn size="sm" variant="ghost" onClick={onToggleFullscreen} title={fullscreenLabel}>
            ⛶
          </Btn>
        )}
        <Btn
          size="sm"
          variant="ghost"
          onClick={onExport}
          title="The date/document title at the top of pages is disabled automatically; if it still shows up — turn off 'Headers and footers' in the print dialog"
        >
          ⬇️ PDF
        </Btn>
      </div>
    </div>
  );
}

/** CV preview: an accurate (undistorted) rendering at any sidebar width, zoom, page-count badge,
 * an empty-sections hint, and fullscreen mode (also the entry point on mobile, where the sticky
 * preview column only comes after all the editing cards). */
export function CvPreviewPanel({ doc, onExport }: { doc: CvDoc; onExport: () => void }) {
  const [zoom, setZoom] = useUi("cvbuilder.previewZoom", 1);
  const [fullscreen, setFullscreen] = useState(false);
  const [contentHeight, setContentHeight] = useState(1200);
  const html = buildCvHtml(doc);
  const pages = Math.max(1, Math.ceil(contentHeight / A4_PAGE_HEIGHT));
  const empties = emptySectionLabels(doc);
  return (
    <>
      <Card className="p-0 overflow-hidden">
        <PreviewToolbar
          pages={pages}
          zoom={zoom}
          onZoomChange={setZoom}
          onExport={onExport}
          onToggleFullscreen={() => setFullscreen(true)}
          fullscreenLabel="Fullscreen"
        />
        {/* Now the only element in the sticky column (Appearance/Presets moved to the "Design"
            tab on the left) — the preview can be given more visible height than when it was
            squeezed under other panels. */}
        <ScaledFrame html={html} zoom={zoom} maxHeight="calc(100vh - 11rem)" onContentHeight={setContentHeight} />
        {empties.length > 0 && (
          <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
            Empty sections (won't appear in the PDF): {empties.join(", ")}
          </div>
        )}
      </Card>
      {/* On <lg screens the preview column isn't sticky (the grid becomes single-column) and
          comes after all the editing cards — without this button you'd have to scroll through
          the whole builder to see the result. */}
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        className="lg:hidden fixed bottom-5 right-5 z-30 rounded-full bg-indigo-600 text-white shadow-lg px-4 py-3 text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
      >
        👁 Preview
        {pages > 1 && (
          <span className="text-amber-300" aria-hidden>
            ⚠
          </span>
        )}
      </button>
      {fullscreen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-3 md:p-6">
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setFullscreen(false)}
            className="fixed inset-0 bg-slate-900/60 cursor-default"
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">CV preview</span>
              <button
                onClick={() => setFullscreen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-lg leading-none px-1"
              >
                ✕
              </button>
            </div>
            <PreviewToolbar pages={pages} zoom={zoom} onZoomChange={setZoom} onExport={onExport} />
            <ScaledFrame html={html} zoom={zoom} maxHeight="calc(90vh - 96px)" onContentHeight={setContentHeight} />
          </div>
        </div>
      )}
    </>
  );
}
