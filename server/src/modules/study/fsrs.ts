// FSRS (Free Spaced Repetition Scheduler), v4.5 — сучасна заміна спрощеного SM-2, який був тут
// раніше (`ease`/`interval`, лінійне зростання інтервалу, бінарна оцінка "пам'ятаю/не пам'ятаю").
//
// FSRS моделює пам'ять трьома компонентами (Difficulty/Stability/Retrievability) замість одного
// "ease factor" — це той самий алгоритм, на який перейшов Anki (найпоширеніший SRS-застосунок)
// після років досліджень пам'яті. Ключова відмінність від SM-2: інтервал рахується з реальної
// формули забування (R(t,S) нижче), а не з фіксованого множення "interval *= ease".
//
// Публічна специфікація й дефолтні ваги (w[0..18]): https://github.com/open-spaced-repetition/fsrs4anki
// Формули нижче — пряма реалізація FSRS-4.5 (не бібліотека, щоб не тягнути нову залежність —
// формул небагато й вони стабільні/задокументовані).
import { getFsrsWeights } from "./fsrs-weights.js";

/** 1=Again (не пам'ятаю), 2=Hard (важко), 3=Good (пам'ятаю), 4=Easy (легко). */
export type FsrsRating = 1 | 2 | 3 | 4;

export interface FsrsCardState {
  /** Складність картки для конкретного кандидата, 1..10 (вище — важче запам'ятати). */
  difficulty: number;
  /** Стабільність пам'яті в днях (за скільки днів retrievability впаде до ~90%). */
  stability: number;
}

export interface FsrsScheduleResult extends FsrsCardState {
  /** Скільки днів чекати до наступного повторення (округлено, мін. 1). */
  intervalDays: number;
}

// FSRS: R(t,S) = (1 + FACTOR * t/S) ^ DECAY — ймовірність згадати картку через t днів
// при стабільності S. FACTOR і DECAY фіксовані так, щоб R(S, S) ≈ 0.9 (S визначено як
// "кількість днів до 90% retrievability").
const DECAY = -0.5;
const FACTOR = 19 / 81;
// Цільова retrievability, під яку рахуємо наступний інтервал (стандартний дефолт FSRS — 90%:
// компромісна ціль, не занадто часті повторення, але й не забуваємо надовго).
const DESIRED_RETENTION = 0.9;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;
const MIN_STABILITY = 0.01;
const MAX_INTERVAL_DAYS = 36500; // ~100 років — той самий верхній запобіжник, що й у ts-fsrs/Anki

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Ймовірність згадати картку через `elapsedDays` днів після останнього повторення. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (elapsedDays <= 0) return 1;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/** Скільки днів чекати, щоб retrievability впала рівно до `desiredRetention`. */
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
  // w[0..3] — стартова стабільність для рейтингів Again/Hard/Good/Easy відповідно. Індекс
  // — заздалегідь відомий підтип 0|1|2|3 (rating-1), явно кастимо: TS не звужує тип
  // результату арифметики (rating - 1) до літерального union сам.
  const index = (rating - 1) as 0 | 1 | 2 | 3;
  return Math.max(w[index], MIN_STABILITY);
}

function nextDifficulty(prevDifficulty: number, rating: FsrsRating): number {
  const w = getFsrsWeights();
  const delta = -w[6] * (rating - 3);
  // Лінійне згасання зміни складності при наближенні до максимуму (10) — та ж ідея, що й
  // у "diminishing returns": картку, яка вже майже максимально важка, ще важче зробити важчою.
  const damped = prevDifficulty + delta * ((10 - prevDifficulty) / 9);
  // Mean reversion до "стартової складності при Easy" — запобігає дрейфу оцінки складності
  // в нескінченність за багато повторень одної картки.
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
  const s =
    w[11] * Math.pow(difficulty, -w[12]) * (Math.pow(stability + 1, w[13]) - 1) * Math.exp((1 - retrievabilityNow) * w[14]);
  // Провал НЕ повинен підвищувати стабільність понад те, що вже було — інакше "забув картку"
  // парадоксально планував би довший інтервал, ніж до провалу.
  return Math.max(Math.min(s, stability), MIN_STABILITY);
}

/**
 * Розраховує новий стан картки (D/S) і наступний інтервал повторення за оцінкою `rating`.
 * `prev === null` — картка бачиться вперше (немає попередньої D/S чи дати останнього огляду).
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
