// Color presets for Fit ("high"/"med"/"low") — extracted from view-kit.tsx (keeps that
// file purely component-based for react-refresh) into a separate constants file.
import i18n from "../i18n";
import type { Fit } from "./types";

export const fitTone: Record<Fit, "good" | "indigo" | "rose"> = { high: "good", med: "indigo", low: "rose" };
export const fitText: Record<Fit, string> = { high: "text-good", med: "text-signal", low: "text-rose-600" };

// A Record (not a template literal) so each value stays a literal key i18next's typed t() can
// actually verify against common.json — a `${fit}` interpolation would collapse to a plain
// `string`, the same dynamic-key problem shared/status-labels.ts's statusLabel works around
// with an explicit cast (Fit's small fixed union means we can just avoid that here instead).
const FIT_KEY: Record<Fit, "fit.high" | "fit.med" | "fit.low"> = {
  high: "fit.high",
  med: "fit.med",
  low: "fit.low",
};

/** Translates a Fit value for display. Calls the i18next singleton directly (not a `t` from the
 * caller's own useTranslation()) since callers live in components with different default
 * namespaces — same reasoning as statusLabel. */
export function fitLabel(fit: Fit): string {
  return i18n.t(`common:${FIT_KEY[fit]}`);
}
