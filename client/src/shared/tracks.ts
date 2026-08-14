// Client-side mirror of server/src/shared/tracks.ts's TRACKS/Track — there's no shared
// client/server package in this monorepo, so each side keeps its own copy (same reasoning as
// i18n/locales.ts's AppLocale). Only the taxonomy is mirrored here; full auto-detection
// (resolveTrack, which also weighs CV text) is server-only logic the client doesn't need.
export const TRACKS = ["software", "qa", "devops", "data", "design", "product", "security", "sysadmin", "pm", "ba"] as const;
export type Track = (typeof TRACKS)[number];

// A narrow client-only mirror of server tracks.ts's TRACK_SIGNALS regexes — just the four
// non-technical tracks (vacancy-create-modal.tsx/vacancy-detail-modal.tsx use this to hide the
// Tech stack field for a position that plainly isn't one, per explicit product decision:
// "PM, QA, Design"). Not the full resolveTrack(): this only needs a yes/no on the position
// string itself (no CV text to weigh), and doesn't need to distinguish which non-technical track
// it is, so the signals are collapsed into one check instead of importing the whole taxonomy.
const NON_TECHNICAL_SIGNALS =
  /\b(qa|qc|quality assurance|test(?:er|ing)? engineer|manual test|ux|ui designer|product designer|graphic designer|interaction designer|project manager|program manager|scrum master|pmp|product manager|product owner)\b/i;

export function looksNonTechnical(position: string): boolean {
  return NON_TECHNICAL_SIGNALS.test(position);
}
