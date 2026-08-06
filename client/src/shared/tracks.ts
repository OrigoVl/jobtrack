// Client-side mirror of server/src/shared/tracks.ts's TRACKS/Track — there's no shared
// client/server package in this monorepo, so each side keeps its own copy (same reasoning as
// i18n/locales.ts's AppLocale). Only the taxonomy is mirrored here; auto-detection (resolveTrack)
// is server-only logic that runs against the CV text, not something the client needs.
export const TRACKS = ["software", "qa", "devops", "data", "design", "product", "security", "sysadmin", "pm", "ba"] as const;
export type Track = (typeof TRACKS)[number];
