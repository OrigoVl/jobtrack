// Pure, DB-free "how well do you actually know this skill" scoring — split out of
// roadmap.service.ts for the same reason as shared/demand.ts's computeDemand(): unit-testable
// without a live DB. Combines three signals already tracked elsewhere in the app (the roadmap's
// manual todo/learning/done status, solved practice drills, and flashcard recall) into one 0..100
// number, with an optional manual override that always wins.
import type { RoadmapStatus } from "../../shared/validation.js";

/** Self-declared roadmap status -> base score. */
export const STATUS_SCORE: Record<RoadmapStatus, number> = { todo: 0, learning: 50, done: 100 };

/** Relative weight of each signal in the composite. Renormalized over whichever signals actually
 * have data for a given tech (see computeSkillLevel) — a tech with no curated drills/cards isn't
 * silently capped at the status weight's share, it's scored on status alone. */
export const SKILL_LEVEL_WEIGHTS = { status: 0.5, drills: 0.2, recall: 0.3 } as const;

/** FSRS stability (in days) at which a card counts as fully retained. */
export const MATURE_STABILITY_DAYS = 21;

// A self-declared "done" with nothing in the app to corroborate it (no curated drills or cards
// for that tech's category) must not draw as full mastery on the radar — that's exactly the
// "you === demand always" flat polygon this feature exists to fix. Skills backed by real practice
// data can still reach 100.
export const UNCORROBORATED_CAP = 80;

export interface SkillLevelParts {
  status: number;
  /** null — no curated drills exist for this tech's practice category (signal doesn't apply). */
  drills: number | null;
  /** null — no curated flashcards exist for this tech's practice category. */
  recall: number | null;
}

export interface SkillLevel {
  /** Effective level: the manual override when set, otherwise levelAuto. */
  level: number;
  levelAuto: number;
  levelManual: number | null;
  levelParts: SkillLevelParts;
}

export interface SkillPracticeSignals {
  drillsTotal: number;
  drillsSolved: number;
  cardsTotal: number;
  /** Per-card retention 0..1 for every curated card in the tech's practice category. */
  cardMaturities: number[];
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 0..1 retention for one flashcard's SRS state. Falls back to `intervalDays` when `stability` is
 * null (rows graded before FSRS shipped, see db/types.ts's SrsRow) so old grades still count
 * instead of being treated as unreviewed. undefined (never graded) counts as 0. */
export function cardMaturity(srs: { stability: number | null; intervalDays: number } | undefined): number {
  if (!srs) return 0;
  const days = srs.stability ?? srs.intervalDays;
  return clamp01(days / MATURE_STABILITY_DAYS);
}

export function computeSkillLevel(status: RoadmapStatus, signals: SkillPracticeSignals, manual: number | null): SkillLevel {
  const statusScore = STATUS_SCORE[status];
  const drillsScore = signals.drillsTotal > 0 ? (100 * signals.drillsSolved) / signals.drillsTotal : null;
  const recallScore = signals.cardsTotal > 0 ? (100 * signals.cardMaturities.reduce((sum, m) => sum + m, 0)) / signals.cardsTotal : null;

  const weighted: [number, number][] = [[SKILL_LEVEL_WEIGHTS.status, statusScore]];
  if (drillsScore !== null) weighted.push([SKILL_LEVEL_WEIGHTS.drills, drillsScore]);
  if (recallScore !== null) weighted.push([SKILL_LEVEL_WEIGHTS.recall, recallScore]);
  const totalWeight = weighted.reduce((sum, [w]) => sum + w, 0);
  let levelAuto = Math.round(weighted.reduce((sum, [w, s]) => sum + w * s, 0) / totalWeight);
  if (drillsScore === null && recallScore === null) levelAuto = Math.min(levelAuto, UNCORROBORATED_CAP);

  const level = manual != null ? clamp(Math.round(manual), 0, 100) : levelAuto;
  return {
    level,
    levelAuto,
    levelManual: manual != null ? clamp(Math.round(manual), 0, 100) : null,
    levelParts: {
      status: statusScore,
      drills: drillsScore !== null ? Math.round(drillsScore) : null,
      recall: recallScore !== null ? Math.round(recallScore) : null,
    },
  };
}
