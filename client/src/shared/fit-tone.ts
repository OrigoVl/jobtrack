// Color presets for Fit ("high"/"med"/"low") — extracted from view-kit.tsx (keeps that
// file purely component-based for react-refresh) into a separate constants file.
import type { Fit } from "./types";

export const fitTone: Record<Fit, "emerald" | "amber" | "rose"> = { high: "emerald", med: "amber", low: "rose" };
export const fitText: Record<Fit, string> = { high: "text-signal", med: "text-alert", low: "text-rose-600" };
