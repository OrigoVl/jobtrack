// Coarse IT-profession routing for CONTENT SELECTION (study cards/drills, knowledge base,
// roadmap groups) — a closed set purely for picking which content pool to serve. Deliberately
// separate from profile.domain (free text, used in LLM prompts, see shared/skill-extraction.ts):
// a Track is never a persisted/translated display value, so it doesn't collide with CLAUDE.md's
// "never translate a persisted wire value" rule the way a UI-facing profession label would.
export const TRACKS = ["software", "qa", "devops", "data", "design", "product", "security", "sysadmin"] as const;
export type Track = (typeof TRACKS)[number];
export const DEFAULT_TRACK: Track = "software";

export function isTrack(value: unknown): value is Track {
  return typeof value === "string" && (TRACKS as readonly string[]).includes(value);
}

// Checked in this order because the tracks aren't mutually exclusive by wording alone (e.g. "QA
// Automation Engineer" must resolve to qa, not software, even though "engineer" alone reads as
// software) — most specific/least ambiguous signals first.
const TRACK_SIGNALS: { track: Track; re: RegExp }[] = [
  { track: "security", re: /\b(security|pen(?:etration)? test(?:er|ing)?|infosec|cyber\s?security|soc analyst|appsec)\b/i },
  { track: "qa", re: /\b(qa|qc|quality assurance|test(?:er|ing)? engineer|manual test|automation test|sdet)\b/i },
  { track: "devops", re: /\b(devops|sre|site reliability|platform engineer|infrastructure engineer|cloud engineer)\b/i },
  { track: "sysadmin", re: /\b(sysadmin|system administrator|it support|help ?desk|network administrator|noc engineer)\b/i },
  {
    track: "data",
    re: /\b(data (?:scientist|analyst|engineer)|analytics engineer|machine learning|ml engineer|bi (?:analyst|developer))\b/i,
  },
  { track: "design", re: /\b(ux|ui designer|product designer|graphic designer|interaction designer)\b/i },
  { track: "product", re: /\b(product manager|product owner|scrum master|project manager|business analyst)\b/i },
];

/** Regex-only, offline-safe track guess from free text (profile.domain and/or CV body). Falls
 * back to DEFAULT_TRACK ("software") when nothing matches or the text is empty — preserving
 * today's behavior for every existing profile that never expressed a track. */
export function resolveTrack(domain?: string, cvText?: string): Track {
  const text = `${domain ?? ""} ${cvText ?? ""}`;
  if (!text.trim()) return DEFAULT_TRACK;
  for (const { track, re } of TRACK_SIGNALS) {
    if (re.test(text)) return track;
  }
  return DEFAULT_TRACK;
}

export interface TrackableProfile {
  track?: Track;
  domain?: string;
  cvText?: string;
}

/** The track content selection should actually use: an explicit user override always wins,
 * otherwise best-effort auto-detection from domain/CV text. */
export function effectiveTrack(profile: TrackableProfile): Track {
  if (profile.track && isTrack(profile.track)) return profile.track;
  return resolveTrack(profile.domain, profile.cvText);
}
