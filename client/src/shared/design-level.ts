import type { DesignHistoryEntry } from "./types";

const LEVEL_SAMPLE_SIZE = 3;

export interface DesignLevel {
  level: number;
  sampleSize: number;
}

/** Pure — average of the most recent non-offline (real AI) grades, deliberately NOT wired into
 * the shared Roadmap/Radar system (see the plan's own note: "System Design" collides with an
 * existing drill/card category name, and buildRadarSeries has no pinning mechanism for a skill no
 * vacancy ever demands). Surfaced directly in the trainer's own header instead. Offline/heuristic
 * scores are excluded — a structural-only check isn't comparable rigor to a real AI review, and
 * averaging them in would silently understate real progress. null — no real grade yet. */
export function computeDesignLevel(history: DesignHistoryEntry[]): DesignLevel | null {
  const real = history.filter((h) => !h.offline).slice(0, LEVEL_SAMPLE_SIZE);
  if (real.length === 0) return null;
  const avg = real.reduce((sum, h) => sum + h.score, 0) / real.length;
  return { level: Math.round(avg), sampleSize: real.length };
}
