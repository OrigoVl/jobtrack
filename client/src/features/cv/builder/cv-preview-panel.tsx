import { useEffect, useRef, useState } from "react";
import { Btn, Card, Segmented } from "../../../shared/ui";
import { useUi } from "../../../shared/ui-state";
import type { CvDoc } from "../../../shared/types";
import { buildCvHtml } from "./cv-doc-utils";

// Віртуальна ширина "сторінки" прев'ю в CSS px — та сама, що й max-width тіла в buildCvHtml
// (820px контенту + 2×30px padding). Рендеримо iframe саме в цій ширині і масштабуємо візуально
// (CSS transform), а НЕ даємо браузеру стискати внутрішню розмітку під вузьку колонку — інакше
// шаблон "Дві колонки" на вузькому сайдбарі виглядав би спотворено, а не так, як у реальному PDF.
const PAGE_WIDTH = 880;
// Орієнтовна висота однієї сторінки A4 у CSS px при друку (~96dpi) — лише для підказки "скільки
// сторінок вийде", не точний розрахунок: реальний друк прибирає max-width (див. @media print у
// buildCvHtml) і додає власні поля браузера, тож фактична кількість сторінок може відрізнятись.
const A4_PAGE_HEIGHT = 1050;

const ZOOM_OPTIONS = [
  { value: 0.8, label: "80%" },
  { value: 1, label: "100%" },
  { value: 1.25, label: "125%" },
];

/** Секції, що ще порожні й не потраплять у згенерований PDF — швидка інформативна підказка. */
function emptySectionLabels(doc: CvDoc): string[] {
  const checks: [boolean, string][] = [
    [!doc.summary.trim(), "Профіль"],
    [doc.skills.length === 0, "Навички"],
    [doc.experience.length === 0, "Досвід"],
    [doc.projects.filter(Boolean).length === 0, "Проєкти"],
    [doc.education.filter(Boolean).length === 0, "Освіта"],
    [(doc.languages ?? []).filter((l) => l.name.trim()).length === 0, "Мови"],
  ];
  return checks.filter(([empty]) => empty).map(([, label]) => label);
}

/**
 * Масштабоване iframe-прев'ю фіксованої "сторінкової" ширини (PAGE_WIDTH). Внутрішня розмітка
 * завжди рендериться в тій самій ширині, що й реальний PDF, — самий контейнер лише візуально
 * масштабується (CSS transform) під ширину доступного місця (ResizeObserver) і обраний зум.
 * Завдяки цьому прев'ю в вузькому сайдбарі виглядає так само, як воно вийде в PDF, а не
 * спотворено-стиснутим через reflow вузького iframe.
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

/** Заголовок панелі прев'ю: бейдж кількості сторінок, зум і дії — спільний для inline-картки й fullscreen-модалки. */
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
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Прев'ю (як у PDF)</span>
        <span
          title="Орієнтовна кількість сторінок при друку в PDF — реальний друк може трохи відрізнятись"
          className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
            pages > 1 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {pages > 1 ? `⚠ ~${pages} стор.` : "✓ 1 стор."}
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
          title="Дата/назва документа зверху сторінок вимкнені автоматично; якщо все ж з'являються — вимкни «Заголовки та підвали» у вікні друку"
        >
          ⬇️ PDF
        </Btn>
      </div>
    </div>
  );
}

/** Прев'ю CV: точне (нескотчене) відображення в будь-якій ширині сайдбара, зум, бейдж кількості
 * сторінок, підказка про порожні секції та fullscreen-режим (він же — точка входу для мобільних,
 * де sticky-колонка з прев'ю йде лише після всіх карток редагування). */
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
          fullscreenLabel="На весь екран"
        />
        {/* Тепер це єдиний елемент у sticky-колонці (Appearance/Presets переїхали у вкладку
            "Дизайн" зліва) — можна віддати прев'ю більше видимої висоти, ніж коли воно було
            затиснуте під іншими панелями. */}
        <ScaledFrame html={html} zoom={zoom} maxHeight="calc(100vh - 11rem)" onContentHeight={setContentHeight} />
        {empties.length > 0 && (
          <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
            Порожні секції (не потраплять у PDF): {empties.join(", ")}
          </div>
        )}
      </Card>
      {/* На <lg екранах прев'ю-колонка не sticky (грід стає одноколонковим) і йде після всіх карток
          редагування — без цієї кнопки довелось би гортати весь конструктор, щоб побачити результат. */}
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        className="lg:hidden fixed bottom-5 right-5 z-30 rounded-full bg-indigo-600 text-white shadow-lg px-4 py-3 text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
      >
        👁 Прев'ю
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
            aria-label="Закрити прев'ю"
            onClick={() => setFullscreen(false)}
            className="fixed inset-0 bg-slate-900/60 cursor-default"
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Прев'ю CV</span>
              <button
                onClick={() => setFullscreen(false)}
                aria-label="Закрити"
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
