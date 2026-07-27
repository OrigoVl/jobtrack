import { useState } from "react";
import { Btn, Segmented, Section } from "../../../shared/ui";
import { useToast } from "../../../shared/toast";
import type { CvDoc, CvTheme } from "../../../shared/types";
import { PhotoCropper } from "./photo-cropper";

const TEMPLATES: [CvTheme["template"], string][] = [
  ["classic", "Класичний"],
  ["compact", "Компактний"],
  ["academic", "Академічний"],
  ["twocol", "Дві колонки"],
];

interface AppearancePanelProps {
  doc: CvDoc;
  theme: CvTheme;
  onSetTheme: (p: Partial<CvTheme>) => void;
  onSetPhoto: (dataUrl: string) => void;
}

/** Вибір шаблону, стилю (акцент/шрифт/масштаб) і фото (з кадруванням). */
export function AppearancePanel({ doc, theme, onSetTheme, onSetPhoto }: AppearancePanelProps) {
  const { toast } = useToast();
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const pickPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Обери файл зображення (PNG/JPG)", "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("Зображення завелике (макс 8 МБ)", "error");
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
      <Section title="Шаблон" icon="🧩" defaultOpen hint={TEMPLATES.find(([id]) => id === theme.template)?.[1]}>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map(([id, label]) => (
            <button
              key={id}
              onClick={() => onSetTheme({ template: id })}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${theme.template === id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Стиль" icon="🎨" hint={`${theme.font === "serif" ? "Serif" : "Sans"} · ${Math.round(theme.scale * 100)}%`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Акцент
            <input
              type="color"
              value={theme.accent}
              onChange={(e) => onSetTheme({ accent: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border border-slate-200 bg-white p-0.5"
            />
          </label>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            Шрифт
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
        <label className="block text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Масштаб тексту</span>
            <span className="text-slate-400">{Math.round(theme.scale * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.3}
            step={0.05}
            value={theme.scale}
            onChange={(e) => onSetTheme({ scale: Number(e.target.value) })}
            aria-label="Масштаб тексту"
            className="w-full mt-1 accent-indigo-600"
          />
        </label>
      </Section>
      <Section title="Фото" icon="🖼" hint={doc.photo ? (theme.showPhoto === false ? "приховано" : "додано") : "немає"}>
        <div className="flex items-center gap-3">
          {doc.photo ? (
            <img
              src={doc.photo}
              alt="Фото"
              className={`w-16 h-16 object-cover border-2 border-indigo-200 ${theme.photoShape === "square" ? "rounded-lg" : "rounded-full"}`}
            />
          ) : (
            <div
              className={`w-16 h-16 bg-slate-100 border-2 border-dashed border-slate-300 grid place-items-center text-slate-400 text-xl ${theme.photoShape === "square" ? "rounded-lg" : "rounded-full"}`}
            >
              👤
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap">
            <label className="inline-flex items-center gap-1 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200">
              {doc.photo ? "🔄 Змінити" : "🖼 Додати"}
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
                Прибрати
              </Btn>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>Форма</span>
          <Segmented
            value={theme.photoShape ?? "circle"}
            onChange={(v) => onSetTheme({ photoShape: v })}
            options={[
              { value: "circle", label: "● Коло" },
              { value: "square", label: "■ Квадрат" },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>Позиція</span>
          <Segmented
            value={theme.photoPos ?? "left"}
            onChange={(v) => onSetTheme({ photoPos: v })}
            options={[
              { value: "left", label: "← Ліво" },
              { value: "right", label: "Право →" },
            ]}
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={theme.showPhoto !== false}
            onChange={(e) => onSetTheme({ showPhoto: e.target.checked })}
            className="accent-indigo-600"
          />
          Показувати фото в PDF
        </label>
      </Section>
      {cropSrc && (
        <PhotoCropper
          src={cropSrc}
          onCancel={closeCrop}
          onDone={(dataUrl) => {
            onSetPhoto(dataUrl);
            closeCrop();
            toast("Фото додано", "success");
          }}
        />
      )}
    </>
  );
}
