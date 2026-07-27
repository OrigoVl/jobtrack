// Дрібні спільні хелпери, що використовуються у кількох view-файлах.
import type { Fit } from "./types";

export const fitTone: Record<Fit, "emerald" | "amber" | "rose"> = { high: "emerald", med: "amber", low: "rose" };
export const fitText: Record<Fit, string> = { high: "text-emerald-600", med: "text-amber-600", low: "text-rose-600" };

/** Простий текстовий інпут з лейблом — використовується у CV (перегляд) та Конструкторі CV. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-0.5 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </label>
  );
}
