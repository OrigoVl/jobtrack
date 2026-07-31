import { useState } from "react";
import { Btn, Segmented, Section } from "../../../shared/ui";
import { useToast } from "../../../shared/use-toast";
import type { CvDoc, CvTheme } from "../../../shared/types";
import { PhotoCropper } from "./photo-cropper";

const TEMPLATES: [CvTheme["template"], string][] = [
  ["classic", "Classic"],
  ["compact", "Compact"],
  ["academic", "Academic"],
  ["twocol", "Two columns"],
  ["minimal", "Minimal"],
  ["sidebar", "Sidebar"],
  ["timeline", "Timeline"],
];

interface AppearancePanelProps {
  doc: CvDoc;
  theme: CvTheme;
  onSetTheme: (p: Partial<CvTheme>) => void;
  onSetPhoto: (dataUrl: string) => void;
}

/** Choosing a template, style (accent/font/scale), and photo (with cropping). */
export function AppearancePanel({ doc, theme, onSetTheme, onSetPhoto }: AppearancePanelProps) {
  const { toast } = useToast();
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const pickPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Choose an image file (PNG/JPG)", "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("Image too large (max 8 MB)", "error");
      return;
    }
    setCropSrc(URL.createObjectURL(file));
  };
  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };
  return (
    <>
      <Section title="Template" icon="🧩" defaultOpen hint={TEMPLATES.find(([id]) => id === theme.template)?.[1]}>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map(([id, label]) => (
            <button
              key={id}
              onClick={() => onSetTheme({ template: id })}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${theme.template === id ? "border-signal bg-signal/10 text-signal" : "border-grid text-ink-dim hover:bg-surface-2"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Style" icon="🎨" hint={`${theme.font === "serif" ? "Serif" : "Sans"} · ${Math.round(theme.scale * 100)}%`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-ink-dim">
            Accent
            <input
              type="color"
              value={theme.accent}
              onChange={(e) => onSetTheme({ accent: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border border-grid bg-white p-0.5"
            />
          </label>
          <div className="flex items-center gap-2 text-sm text-ink-dim">
            Font
            <Segmented
              value={theme.font}
              onChange={(v) => onSetTheme({ font: v })}
              options={[
                { value: "sans", label: "Sans" },
                { value: "serif", label: "Serif" },
              ]}
            />
          </div>
        </div>
        <label className="block text-sm text-ink-dim">
          <div className="flex justify-between">
            <span>Text scale</span>
            <span className="text-ink-dim">{Math.round(theme.scale * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.3}
            step={0.05}
            value={theme.scale}
            onChange={(e) => onSetTheme({ scale: Number(e.target.value) })}
            aria-label="Text scale"
            className="w-full mt-1 accent-signal"
          />
        </label>
      </Section>
      <Section title="Photo" icon="🖼" hint={doc.photo ? (theme.showPhoto === false ? "hidden" : "added") : "none"}>
        <div className="flex items-center gap-3">
          {doc.photo ? (
            <img
              src={doc.photo}
              alt=""
              className={`w-16 h-16 object-cover border-2 border-signal/30 ${theme.photoShape === "square" ? "rounded-lg" : "rounded-full"}`}
            />
          ) : (
            <div
              className={`w-16 h-16 bg-surface-2 border-2 border-dashed border-grid grid place-items-center text-ink-dim text-xl ${theme.photoShape === "square" ? "rounded-lg" : "rounded-full"}`}
            >
              👤
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap">
            <label className="inline-flex items-center gap-1 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer bg-surface-2 text-ink border border-grid hover:bg-grid">
              {doc.photo ? "🔄 Change" : "🖼 Add"}
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
                Remove
              </Btn>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-ink-dim">
          <span>Shape</span>
          <Segmented
            value={theme.photoShape ?? "circle"}
            onChange={(v) => onSetTheme({ photoShape: v })}
            options={[
              { value: "circle", label: "● Circle" },
              { value: "square", label: "■ Square" },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-ink-dim">
          <span>Position</span>
          <Segmented
            value={theme.photoPos ?? "left"}
            onChange={(v) => onSetTheme({ photoPos: v })}
            options={[
              { value: "left", label: "← Left" },
              { value: "right", label: "Right →" },
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
          Show photo in the PDF
        </label>
      </Section>
      {cropSrc && (
        <PhotoCropper
          src={cropSrc}
          onCancel={closeCrop}
          onDone={(dataUrl) => {
            onSetPhoto(dataUrl);
            closeCrop();
            toast("Photo added", "success");
          }}
        />
      )}
    </>
  );
}
