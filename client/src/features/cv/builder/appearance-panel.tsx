import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Segmented, Section } from "../../../shared/ui";
import { useToast } from "../../../shared/use-toast";
import { UserIcon } from "../../../shared/icons";
import type { CvDoc, CvTheme } from "../../../shared/types";
import { PhotoCropper } from "./photo-cropper";

const TEMPLATE_KEYS: [
  CvTheme["template"],
  (
    | "templates.classic"
    | "templates.compact"
    | "templates.academic"
    | "templates.twocol"
    | "templates.minimal"
    | "templates.sidebar"
    | "templates.timeline"
  ),
][] = [
  ["classic", "templates.classic"],
  ["compact", "templates.compact"],
  ["academic", "templates.academic"],
  ["twocol", "templates.twocol"],
  ["minimal", "templates.minimal"],
  ["sidebar", "templates.sidebar"],
  ["timeline", "templates.timeline"],
];

/**
 * A ~A4-proportioned skeleton of each template's page structure — accent-coloured blocks for
 * headings/rules, grey ones for body lines. Deliberately abstract (no legible text): the choice
 * being made here is "where does stuff sit on the page", and a row of seven text-only buttons
 * made that answerable only by clicking each one in turn and watching the real preview change.
 *
 * `accent` is the live theme colour, so the thumbnails re-tint as soon as a swatch is picked and
 * the grid doubles as a preview of that choice too.
 */
function TemplateThumb({ template, accent }: { template: CvTheme["template"]; accent: string }) {
  const line = "currentColor";
  // 40×52 viewBox ≈ A4's 1:1.41. Every template draws into the same box so the seven thumbnails
  // read as variations of one page rather than seven unrelated icons.
  const body = () => {
    switch (template) {
      case "twocol":
        return (
          <>
            <rect x="5" y="5" width="20" height="3" fill={accent} />
            <rect x="5" y="12" width="14" height="1.5" fill={line} />
            <rect x="5" y="18" width="13" height="2" fill={accent} />
            <rect x="5" y="23" width="14" height="1.5" fill={line} />
            <rect x="5" y="27" width="12" height="1.5" fill={line} />
            <rect x="5" y="31" width="14" height="1.5" fill={line} />
            <rect x="21" y="18" width="13" height="2" fill={accent} />
            <rect x="21" y="23" width="14" height="1.5" fill={line} />
            <rect x="21" y="27" width="11" height="1.5" fill={line} />
            <rect x="21" y="31" width="14" height="1.5" fill={line} />
          </>
        );
      case "sidebar":
        return (
          <>
            <rect x="4" y="4" width="11" height="44" fill={accent} opacity="0.25" />
            <rect x="6" y="7" width="7" height="2" fill={accent} />
            <rect x="6" y="12" width="7" height="1.5" fill={line} />
            <rect x="6" y="16" width="6" height="1.5" fill={line} />
            <rect x="6" y="20" width="7" height="1.5" fill={line} />
            <rect x="18" y="6" width="16" height="3" fill={accent} />
            <rect x="18" y="14" width="12" height="2" fill={accent} />
            <rect x="18" y="19" width="17" height="1.5" fill={line} />
            <rect x="18" y="23" width="15" height="1.5" fill={line} />
            <rect x="18" y="29" width="12" height="2" fill={accent} />
            <rect x="18" y="34" width="17" height="1.5" fill={line} />
            <rect x="18" y="38" width="14" height="1.5" fill={line} />
          </>
        );
      case "timeline":
        return (
          <>
            <rect x="5" y="5" width="22" height="3" fill={accent} />
            <rect x="9" y="14" width="1" height="30" fill={accent} opacity="0.4" />
            <circle cx="9.5" cy="17" r="2" fill={accent} />
            <rect x="14" y="15" width="18" height="2" fill={accent} />
            <rect x="14" y="20" width="16" height="1.5" fill={line} />
            <circle cx="9.5" cy="29" r="2" fill={accent} />
            <rect x="14" y="27" width="18" height="2" fill={accent} />
            <rect x="14" y="32" width="15" height="1.5" fill={line} />
            <circle cx="9.5" cy="41" r="2" fill={accent} />
            <rect x="14" y="39" width="17" height="2" fill={accent} />
          </>
        );
      case "academic":
        return (
          <>
            <rect x="11" y="5" width="18" height="3" fill={accent} />
            <rect x="14" y="11" width="12" height="1.5" fill={line} />
            <rect x="5" y="18" width="30" height="0.8" fill={accent} />
            <rect x="5" y="22" width="11" height="2" fill={accent} />
            <rect x="5" y="27" width="30" height="1.5" fill={line} />
            <rect x="5" y="31" width="27" height="1.5" fill={line} />
            <rect x="5" y="37" width="11" height="2" fill={accent} />
            <rect x="5" y="42" width="30" height="1.5" fill={line} />
          </>
        );
      case "minimal":
        return (
          <>
            <rect x="5" y="7" width="18" height="2.5" fill={line} />
            <rect x="5" y="14" width="26" height="1.5" fill={line} />
            <rect x="5" y="18" width="23" height="1.5" fill={line} />
            <rect x="5" y="26" width="9" height="1.5" fill={accent} />
            <rect x="5" y="31" width="26" height="1.5" fill={line} />
            <rect x="5" y="35" width="22" height="1.5" fill={line} />
            <rect x="5" y="42" width="9" height="1.5" fill={accent} />
          </>
        );
      case "compact":
        return (
          <>
            <rect x="5" y="5" width="20" height="2.5" fill={accent} />
            <rect x="5" y="11" width="30" height="1.2" fill={line} />
            <rect x="5" y="14" width="28" height="1.2" fill={line} />
            <rect x="5" y="17" width="30" height="1.2" fill={line} />
            <rect x="5" y="22" width="10" height="1.8" fill={accent} />
            <rect x="5" y="26" width="30" height="1.2" fill={line} />
            <rect x="5" y="29" width="29" height="1.2" fill={line} />
            <rect x="5" y="32" width="30" height="1.2" fill={line} />
            <rect x="5" y="37" width="10" height="1.8" fill={accent} />
            <rect x="5" y="41" width="30" height="1.2" fill={line} />
            <rect x="5" y="44" width="27" height="1.2" fill={line} />
          </>
        );
      default:
        return (
          <>
            <rect x="5" y="5" width="22" height="3" fill={accent} />
            <rect x="5" y="12" width="16" height="1.5" fill={line} />
            <rect x="5" y="19" width="11" height="2" fill={accent} />
            <rect x="5" y="24" width="30" height="1.5" fill={line} />
            <rect x="5" y="28" width="26" height="1.5" fill={line} />
            <rect x="5" y="35" width="11" height="2" fill={accent} />
            <rect x="5" y="40" width="30" height="1.5" fill={line} />
            <rect x="5" y="44" width="24" height="1.5" fill={line} />
          </>
        );
    }
  };
  return (
    <svg viewBox="0 0 40 52" className="w-full h-auto rounded-sm bg-white text-slate-300 shadow-sm" role="presentation">
      {body()}
    </svg>
  );
}

// Curated, resume-appropriate accent swatches — a quicker path to a good-looking result than
// hunting through the raw <input type="color"> wheel; the picker itself stays for anyone who
// wants an exact brand color. Not persisted/validated separately — clicking one is just shorthand
// for onSetTheme({ accent: hex }), same as picking any other color.
const ACCENT_PRESETS = ["#4f46e5", "#1e3a8a", "#0f766e", "#15803d", "#9f1239", "#334155", "#c2410c", "#7e22ce"];

// Multi-column templates split content into independent DOM regions (aside/main) that print to a
// visually two-column PDF — many ATS/PDF text-extraction tools linearize by X/Y page position
// rather than DOM order, so a two-column PDF can come out with lines from both columns
// interleaved. Single-column templates don't have this failure mode at all.
const ATS_RISK_TEMPLATES = new Set<CvTheme["template"]>(["twocol", "sidebar"]);

interface AppearancePanelProps {
  doc: CvDoc;
  theme: CvTheme;
  onSetTheme: (p: Partial<CvTheme>) => void;
  onSetPhoto: (dataUrl: string) => void;
}

/** Choosing a template, style (accent/font/scale), and photo (with cropping). */
export function AppearancePanel({ doc, theme, onSetTheme, onSetPhoto }: AppearancePanelProps) {
  const { t } = useTranslation(["cv", "common"]);
  const { toast } = useToast();
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const pickPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast(t("appearance.photo.invalidFileToast"), "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast(t("appearance.photo.tooLargeToast"), "error");
      return;
    }
    setCropSrc(URL.createObjectURL(file));
  };
  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };
  const fontLabel = (font: CvTheme["font"]) => (font === "serif" ? t("appearance.style.serif") : t("appearance.style.sans"));
  return (
    <>
      <Section
        title={t("appearance.template.title")}
        defaultOpen
        hint={t(TEMPLATE_KEYS.find(([id]) => id === theme.template)?.[1] ?? "templates.classic")}
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {TEMPLATE_KEYS.map(([id, labelKey]) => (
            <button
              key={id}
              onClick={() => onSetTheme({ template: id })}
              aria-pressed={theme.template === id}
              className={`flex flex-col gap-1.5 p-1.5 rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 ${theme.template === id ? "border-signal bg-signal/10 text-signal" : "border-grid text-ink-dim hover:bg-surface-2"}`}
            >
              <TemplateThumb template={id} accent={theme.accent} />
              <span className="text-[11px] font-medium leading-tight text-center">{t(labelKey)}</span>
            </button>
          ))}
        </div>
        {ATS_RISK_TEMPLATES.has(theme.template) && <div className="text-[11px] text-ink-dim">{t("appearance.template.atsRiskHint")}</div>}
      </Section>
      <Section title={t("appearance.style.title")} hint={`${fontLabel(theme.font)} · ${Math.round(theme.scale * 100)}%`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-ink-dim">
            {t("appearance.style.accent")}
            <input
              type="color"
              value={theme.accent}
              onChange={(e) => onSetTheme({ accent: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border border-grid bg-white p-0.5"
            />
          </label>
          <div className="flex items-center gap-2 text-sm text-ink-dim">
            {t("appearance.style.font")}
            <Segmented
              value={theme.font}
              onChange={(v) => onSetTheme({ font: v })}
              options={[
                { value: "sans", label: t("appearance.style.sans") },
                { value: "serif", label: t("appearance.style.serif") },
              ]}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {ACCENT_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onSetTheme({ accent: hex })}
              title={hex}
              aria-label={hex}
              style={{ background: hex }}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${theme.accent.toLowerCase() === hex ? "border-ink scale-110" : "border-transparent hover:scale-110"}`}
            />
          ))}
        </div>
        <label className="block text-sm text-ink-dim">
          <div className="flex justify-between">
            <span>{t("appearance.style.textScale")}</span>
            <span className="text-ink-dim">{Math.round(theme.scale * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.3}
            step={0.05}
            value={theme.scale}
            onChange={(e) => onSetTheme({ scale: Number(e.target.value) })}
            aria-label={t("appearance.style.textScale")}
            className="w-full mt-1 accent-signal"
          />
        </label>
      </Section>
      <Section
        title={t("appearance.photo.title")}
        hint={
          doc.photo ? (theme.showPhoto === false ? t("appearance.photo.hidden") : t("appearance.photo.added")) : t("appearance.photo.none")
        }
      >
        <div className="flex items-center gap-3">
          {doc.photo ? (
            <img
              src={doc.photo}
              alt=""
              className={`w-16 h-16 object-cover border-2 border-signal/30 ${theme.photoShape === "square" ? "rounded-lg" : "rounded-full"}`}
            />
          ) : (
            <div
              className={`w-16 h-16 bg-surface-2 border-2 border-dashed border-grid grid place-items-center text-ink-dim ${theme.photoShape === "square" ? "rounded-lg" : "rounded-full"}`}
            >
              <UserIcon className="h-6 w-6" />
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap">
            <label className="inline-flex items-center gap-1 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer bg-surface-2 text-ink border border-grid hover:bg-grid">
              {doc.photo ? t("appearance.photo.change") : t("appearance.photo.add")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  pickPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {doc.photo && (
              <Btn size="sm" variant="danger" onClick={() => onSetPhoto("")}>
                {t("appearance.photo.remove")}
              </Btn>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-ink-dim">
          <span>{t("appearance.photo.shape")}</span>
          <Segmented
            value={theme.photoShape ?? "circle"}
            onChange={(v) => onSetTheme({ photoShape: v })}
            options={[
              { value: "circle", label: t("appearance.photo.circle") },
              { value: "square", label: t("appearance.photo.square") },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-ink-dim">
          <span>{t("appearance.photo.position")}</span>
          <Segmented
            value={theme.photoPos ?? "left"}
            onChange={(v) => onSetTheme({ photoPos: v })}
            options={[
              { value: "left", label: t("appearance.photo.left") },
              { value: "right", label: t("appearance.photo.right") },
            ]}
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-ink-dim cursor-pointer">
          <input
            type="checkbox"
            checked={theme.showPhoto !== false}
            onChange={(e) => onSetTheme({ showPhoto: e.target.checked })}
            className="accent-signal"
          />
          {t("appearance.photo.showInPdf")}
        </label>
      </Section>
      {cropSrc && (
        <PhotoCropper
          src={cropSrc}
          onCancel={closeCrop}
          onDone={(dataUrl) => {
            onSetPhoto(dataUrl);
            closeCrop();
            toast(t("appearance.photo.addedToast"), "success");
          }}
        />
      )}
    </>
  );
}
