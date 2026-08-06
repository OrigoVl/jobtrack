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
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATE_KEYS.map(([id, labelKey]) => (
            <button
              key={id}
              onClick={() => onSetTheme({ template: id })}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${theme.template === id ? "border-signal bg-signal/10 text-signal" : "border-grid text-ink-dim hover:bg-surface-2"}`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
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
