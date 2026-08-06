// Translates a Track value for display. Track is a small, closed union (see shared/tracks.ts),
// same reasoning as fit-tone.ts's fitLabel — a Record keeps every value a literal key i18next's
// typed t() can verify against common.json, rather than a template-literal interpolation that
// would collapse to a plain `string`.
import i18n from "../i18n";
import type { Track } from "./tracks";

const TRACK_KEY: Record<Track, `tracks.${Track}`> = {
  software: "tracks.software",
  qa: "tracks.qa",
  devops: "tracks.devops",
  data: "tracks.data",
  design: "tracks.design",
  product: "tracks.product",
  security: "tracks.security",
  sysadmin: "tracks.sysadmin",
};

/** Calls the i18next singleton directly (not a `t` from the caller's own useTranslation()) since
 * callers live in components with different default namespaces — same reasoning as
 * shared/status-labels.ts's statusLabel. */
export function trackLabel(track: Track): string {
  return i18n.t(`common:${TRACK_KEY[track]}`);
}
