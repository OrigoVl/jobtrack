import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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
function emptySectionLabels(doc: CvDoc, t: TFunction<["cv", "common"]>): string[] {
  const checks: [boolean, string][] = [
    [!doc.summary.trim(), t("preview.emptyLabels.summary")],
    [doc.skills.length === 0, t("preview.emptyLabels.skills")],
    [doc.experience.length === 0, t("preview.emptyLabels.experience")],
    [doc.projects.filter(Boolean).length === 0, t("preview.emptyLabels.projects")],
    [doc.education.filter(Boolean).length === 0, t("preview.emptyLabels.education")],
    [(doc.languages ?? []).filter((l) => l.name.trim()).length === 0, t("preview.emptyLabels.languages")],
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
  onSectionClick,
}: {
  html: string;
  zoom: number;
  maxHeight: string;
  onContentHeight: (h: number) => void;
  /** Fired when a `[data-section]` element inside the preview is clicked (see cv-doc-utils.ts) —
   * lets the editor jump straight to the section/entry that was clicked. Attached directly to
   * `contentDocument` rather than via an injected <script>+postMessage: a `srcdoc` iframe is
   * scriptable from the parent just like same-origin content, so this needs no CSP changes. */
  onSectionClick?: (section: string) => void;
}) {
  const { t } = useTranslation(["cv", "common"]);
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
    <div ref={viewportRef} className="overflow-auto bg-surface-2" style={{ maxHeight }}>
      <div className="flex justify-center py-4">
        <div
          style={{ width: PAGE_WIDTH * scale, height: contentHeight * scale, overflow: "hidden" }}
          className="shadow-xl ring-1 ring-ink/5 shrink-0 rounded-sm"
        >
          <iframe
            title={t("preview.iframeTitlePreview")}
            srcDoc={html}
            onLoad={(e) => {
              const doc = e.currentTarget.contentDocument;
              const h = doc?.documentElement.scrollHeight ?? 1200;
              setContentHeight(h);
              onContentHeight(h);
              if (doc && onSectionClick) {
                doc.addEventListener("click", (ev) => {
                  const el = (ev.target as HTMLElement).closest("[data-section]");
                  if (el) onSectionClick(el.getAttribute("data-section") || "");
                });
              }
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
  const { t } = useTranslation(["cv", "common"]);
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-surface-2 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">{t("preview.toolbarLabel")}</span>
        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full border border-grid bg-surface-2 text-ink-dim whitespace-nowrap">
          A4
        </span>
        <span
          title={t("preview.pagesHintTitle")}
          className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
            pages > 1 ? "bg-alert/10 text-alert border-alert/30" : "bg-signal/10 text-signal border-signal/30"
          }`}
        >
          {pages > 1 ? t("preview.pageBadgeMulti", { pages }) : t("preview.pageBadgeSingle")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Segmented value={zoom} onChange={onZoomChange} options={ZOOM_OPTIONS} size="sm" />
        {onToggleFullscreen && (
          <Btn size="sm" variant="ghost" onClick={onToggleFullscreen} title={fullscreenLabel}>
            ⛶
          </Btn>
        )}
        <Btn size="sm" variant="ghost" onClick={onExport} title={t("preview.exportTitle")}>
          {t("shared.pdfButton")}
        </Btn>
      </div>
    </div>
  );
}

/** CV preview: an accurate (undistorted) rendering at any sidebar width, zoom, page-count badge,
 * an empty-sections hint, and fullscreen mode (also the entry point on mobile, where the sticky
 * preview column only comes after all the editing cards). */
export function CvPreviewPanel({
  doc,
  onExport,
  onSectionClick,
}: {
  doc: CvDoc;
  onExport: () => void;
  onSectionClick?: (section: string) => void;
}) {
  const { t } = useTranslation(["cv", "common"]);
  const [zoom, setZoom] = useUi("cvbuilder.previewZoom", 1);
  const [fullscreen, setFullscreen] = useState(false);
  const [contentHeight, setContentHeight] = useState(1200);
  const html = buildCvHtml(doc);
  const pages = Math.max(1, Math.ceil(contentHeight / A4_PAGE_HEIGHT));
  const empties = emptySectionLabels(doc, t);
  return (
    <>
      <Card className="p-0 overflow-hidden">
        <PreviewToolbar
          pages={pages}
          zoom={zoom}
          onZoomChange={setZoom}
          onExport={onExport}
          onToggleFullscreen={() => setFullscreen(true)}
          fullscreenLabel={t("preview.fullscreen")}
        />
        {/* Now the only element in the sticky column (Appearance/Presets moved to the "Design"
            tab on the left) — the preview can be given more visible height than when it was
            squeezed under other panels. */}
        <ScaledFrame
          html={html}
          zoom={zoom}
          maxHeight="calc(100vh - 11rem)"
          onContentHeight={setContentHeight}
          onSectionClick={onSectionClick}
        />
        <div className="px-4 py-1.5 text-[11px] text-ink-dim border-t border-surface-2">{t("preview.clickHint")}</div>
        {empties.length > 0 && (
          <div className="px-4 py-2 text-[11px] text-ink-dim border-t border-surface-2">
            {t("preview.emptySectionsHint", { sections: empties.join(", ") })}
          </div>
        )}
      </Card>
      {/* On <lg screens the preview column isn't sticky (the grid becomes single-column) and
          comes after all the editing cards — without this button you'd have to scroll through
          the whole builder to see the result. */}
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        className="lg:hidden fixed bottom-5 right-5 z-30 rounded-full bg-signal text-white shadow-lg px-4 py-3 text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 focus-visible:ring-offset-2"
      >
        {t("preview.previewFab")}
        {pages > 1 && (
          <span className="text-alert/40" aria-hidden>
            ⚠
          </span>
        )}
      </button>
      {fullscreen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-3 md:p-6">
          <button
            type="button"
            aria-label={t("preview.closePreviewAria")}
            onClick={() => setFullscreen(false)}
            className="fixed inset-0 bg-ink/60 cursor-default"
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-surface-2">
              <span className="text-sm font-semibold text-ink">{t("preview.modalTitle")}</span>
              <button
                onClick={() => setFullscreen(false)}
                aria-label={t("common:actions.close")}
                className="text-ink-dim hover:text-ink-dim text-lg leading-none px-1"
              >
                ✕
              </button>
            </div>
            <PreviewToolbar pages={pages} zoom={zoom} onZoomChange={setZoom} onExport={onExport} />
            <ScaledFrame
              html={html}
              zoom={zoom}
              maxHeight="calc(90vh - 96px)"
              onContentHeight={setContentHeight}
              onSectionClick={onSectionClick}
            />
          </div>
        </div>
      )}
    </>
  );
}
