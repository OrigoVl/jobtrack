// Кольорові пресети для Fit ("high"/"med"/"low") — винесено з view-kit.tsx (лишає той
// файл суто компонентним для react-refresh) у окремий файл констант.
import type { Fit } from "./types";

export const fitTone: Record<Fit, "emerald" | "amber" | "rose"> = { high: "emerald", med: "amber", low: "rose" };
export const fitText: Record<Fit, string> = { high: "text-emerald-600", med: "text-amber-600", low: "text-rose-600" };
