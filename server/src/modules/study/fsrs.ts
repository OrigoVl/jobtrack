// FSRS (Free Spaced Repetition Scheduler), v4.5 — a modern replacement for the simplified SM-2
// that used to live here (`ease`/`interval`, linear interval growth, binary "remembered/forgot" rating).
//
// FSRS models memory with three components (Difficulty/Stability/Retrievability) instead of a
// single "ease factor" — this is the same algorithm Anki (the most widely used SRS app) switched
// to after years of memory research. The key difference from SM-2: the interval is computed from
// an actual forgetting-curve formula (R(t,S) below), not from a fixed "interval *= ease" multiplication.
//
// Public spec and default weights (w[0..18]): https://github.com/open-spaced-repetition/fsrs4anki
// The formulas below are a direct implementation of FSRS-4.5 (not a library, to avoid pulling in a
// new dependency — there aren't many formulas and they're stable/well documented).
import { getFsrsWeights } from "./fsrs-weights.js";

/** 1=Again (forgot), 2=Hard (hard), 3=Good (remembered), 4=Easy (easy). */
export type FsrsRating = 1 | 2 | 3 | 4;

export interface FsrsCardState {
  /** Card difficulty for this particular candidate, 1..10 (higher — harder to remember). */
  difficulty: number;
  /** Memory stability in days (how many days until retrievability drops to ~90%). */
  stability: number;
}

export interface FsrsScheduleResult extends FsrsCardState {
  /** How many days to wait until the next review (rounded, min. 1). */
  intervalDays: number;
}

// FSRS: R(t,S) = (1 + FACTOR * t/S) ^ DECAY — probability of recalling the card after t days
// at stability S. FACTOR and DECAY are fixed so that R(S, S) ≈ 0.9 (S is defined as
// "the number of days until 90% retrievability").
const DECAY = -0.5;
const FACTOR = 19 / 81;
// Target retrievability used to compute the next interval (standard FSRS default is 90%:
// a compromise target — not too frequent reviews, but also not forgetting for too long).
const DESIRED_RETENTION = 0.9;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;
const MIN_STABILITY = 0.01;
const MAX_INTERVAL_DAYS = 36500; // ~100 years — the same upper safety cap as in ts-fsrs/Anki

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Probability of recalling the card after `elapsedDays` days since the last review. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (elapsedDays <= 0) return 1;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/** How many days to wait for retrievability to drop exactly to `desiredRetention`. */
function intervalForRetention(stability: number, desiredRetention: number): number {
  const days = (stability / FACTOR) * (Math.pow(desiredRetention, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, MAX_INTERVAL_DAYS);
}

function initialDifficulty(rating: FsrsRating): number {
  const w = getFsrsWeights();
  return clamp(w[4] - (rating - 3) * w[5], MIN_DIFFICULTY, MAX_DIFFICULTY);
}

function initialStability(rating: FsrsRating): number {
  const w = getFsrsWeights();
  // w[0..3] — starting stability for the Again/Hard/Good/Easy ratings respectively. The index
  // is a known-in-advance 0|1|2|3 subtype (rating-1); we cast it explicitly since TS doesn't
  // narrow the result type of the arithmetic (rating - 1) to the literal union on its own.
  const index = (rating - 1) as 0 | 1 | 2 | 3;
  return Math.max(w[index], MIN_STABILITY);
}

function nextDifficulty(prevDifficulty: number, rating: FsrsRating): number {
  const w = getFsrsWeights();
  const delta = -w[6] * (rating - 3);
  // Linear damping of the difficulty change as it approaches the maximum (10) — the same idea
  // as "diminishing returns": a card that's already nearly maximally hard is even harder to make harder.
  const damped = prevDifficulty + delta * ((10 - prevDifficulty) / 9);
  // Mean reversion toward "starting difficulty at Easy" — prevents the difficulty estimate from
  // drifting off to infinity over many repetitions of the same card.
  const reverted = w[7] * initialDifficulty(4) + (1 - w[7]) * damped;
  return clamp(reverted, MIN_DIFFICULTY, MAX_DIFFICULTY);
}

function nextStabilityOnRecall(difficulty: number, stability: number, retrievabilityNow: number, rating: FsrsRating): number {
  const w = getFsrsWeights();
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  const growth =
    1 +
    Math.exp(w[8]) *
      (11 - difficulty) *
      Math.pow(stability, -w[9]) *
      (Math.exp((1 - retrievabilityNow) * w[10]) - 1) *
      hardPenalty *
      easyBonus;
  return Math.max(stability * growth, MIN_STABILITY);
}

function nextStabilityOnLapse(difficulty: number, stability: number, retrievabilityNow: number): number {
  const w = getFsrsWeights();
  const s = w[11] * Math.pow(difficulty, -w[12]) * (Math.pow(stability + 1, w[13]) - 1) * Math.exp((1 - retrievabilityNow) * w[14]);
  // A lapse must NOT raise stability above what it already was — otherwise "forgetting the card"
  // would paradoxically schedule a longer interval than before the lapse.
  return Math.max(Math.min(s, stability), MIN_STABILITY);
}

/**
 * Computes the card's new state (D/S) and the next review interval based on the `rating`.
 * `prev === null` — the card is being seen for the first time (no previous D/S or last review date).
 */
export function scheduleFsrs(prev: FsrsCardState | null, elapsedDays: number, rating: FsrsRating): FsrsScheduleResult {
  if (!prev) {
    const difficulty = initialDifficulty(rating);
    const stability = initialStability(rating);
    return { difficulty, stability, intervalDays: intervalForRetention(stability, DESIRED_RETENTION) };
  }
  const r = retrievability(elapsedDays, prev.stability);
  const difficulty = nextDifficulty(prev.difficulty, rating);
  const stability =
    rating === 1
      ? nextStabilityOnLapse(prev.difficulty, prev.stability, r)
      : nextStabilityOnRecall(prev.difficulty, prev.stability, r, rating);
  return { difficulty, stability, intervalDays: intervalForRetention(stability, DESIRED_RETENTION) };
}
