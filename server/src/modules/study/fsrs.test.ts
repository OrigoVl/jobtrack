// Контрактні тести для FSRS: не перевіряємо точні числа з довгим хвостом десяткових знаків
// (це б зробило тест крихким до найменшого уточнення ваг), а перевіряємо ЯКІСНІ властивості
// алгоритму, які мають виконуватись для БУДЬ-ЯКОГО коректного FSRS-планувальника.
import { describe, expect, it } from "vitest";
import { retrievability, scheduleFsrs, type FsrsCardState } from "./fsrs.js";

describe("retrievability()", () => {
  it("is 1 (100%) at zero elapsed days", () => {
    expect(retrievability(0, 5)).toBe(1);
  });

  it("decreases monotonically as elapsed days grow", () => {
    const r1 = retrievability(1, 10);
    const r5 = retrievability(5, 10);
    const r20 = retrievability(20, 10);
    expect(r1).toBeGreaterThan(r5);
    expect(r5).toBeGreaterThan(r20);
  });

  it("is higher for a more stable card at the same elapsed time", () => {
    expect(retrievability(10, 20)).toBeGreaterThan(retrievability(10, 5));
  });
});

describe("scheduleFsrs() — first review (prev === null)", () => {
  it("gives a longer initial interval for Easy than for Again", () => {
    const again = scheduleFsrs(null, 0, 1);
    const easy = scheduleFsrs(null, 0, 4);
    expect(easy.intervalDays).toBeGreaterThan(again.intervalDays);
    expect(easy.stability).toBeGreaterThan(again.stability);
  });

  it("orders initial intervals monotonically: Again <= Hard <= Good <= Easy", () => {
    const again = scheduleFsrs(null, 0, 1);
    const hard = scheduleFsrs(null, 0, 2);
    const good = scheduleFsrs(null, 0, 3);
    const easy = scheduleFsrs(null, 0, 4);
    expect(again.intervalDays).toBeLessThanOrEqual(hard.intervalDays);
    expect(hard.intervalDays).toBeLessThanOrEqual(good.intervalDays);
    expect(good.intervalDays).toBeLessThanOrEqual(easy.intervalDays);
  });

  it("always returns an interval of at least 1 day", () => {
    for (const rating of [1, 2, 3, 4] as const) {
      expect(scheduleFsrs(null, 0, rating).intervalDays).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("scheduleFsrs() — subsequent reviews", () => {
  const learned: FsrsCardState = { difficulty: 5, stability: 10 };

  it("increases stability (and thus interval) on a 'Good' recall reviewed right on schedule", () => {
    const result = scheduleFsrs(learned, 10, 3);
    expect(result.stability).toBeGreaterThan(learned.stability);
    expect(result.intervalDays).toBeGreaterThan(0);
  });

  it("grows stability more for 'Easy' than for 'Hard' given the same prior state/elapsed time", () => {
    const hard = scheduleFsrs(learned, 10, 2);
    const easy = scheduleFsrs(learned, 10, 4);
    expect(easy.stability).toBeGreaterThan(hard.stability);
  });

  it("drops stability sharply on a lapse ('Again') instead of growing it", () => {
    const result = scheduleFsrs(learned, 10, 1);
    expect(result.stability).toBeLessThan(learned.stability);
  });

  it("penalizes a lapse MORE when it happens early (still high retrievability expected) than when it " +
    "happens very late (low retrievability — forgetting was already expected, less of a surprise)", () => {
    const reviewedOnTime = scheduleFsrs(learned, 1, 1);
    const reviewedLate = scheduleFsrs(learned, 60, 1);
    expect(reviewedOnTime.stability).toBeLessThanOrEqual(reviewedLate.stability);
  });

  it("keeps difficulty within the [1, 10] bounds across many repeated lapses", () => {
    let state: FsrsCardState = { difficulty: 5, stability: 5 };
    for (let i = 0; i < 50; i++) {
      const r = scheduleFsrs(state, 1, 1);
      state = { difficulty: r.difficulty, stability: r.stability };
    }
    expect(state.difficulty).toBeGreaterThanOrEqual(1);
    expect(state.difficulty).toBeLessThanOrEqual(10);
  });

  it("keeps difficulty within the [1, 10] bounds across many repeated easy recalls", () => {
    let state: FsrsCardState = { difficulty: 5, stability: 5 };
    for (let i = 0; i < 50; i++) {
      const r = scheduleFsrs(state, r_days(state.stability), 4);
      state = { difficulty: r.difficulty, stability: r.stability };
    }
    expect(state.difficulty).toBeGreaterThanOrEqual(1);
    expect(state.difficulty).toBeLessThanOrEqual(10);
  });

  it("never returns an interval beyond the 100-year safety cap", () => {
    const result = scheduleFsrs({ difficulty: 1, stability: 1_000_000 }, 1, 4);
    expect(result.intervalDays).toBeLessThanOrEqual(36500);
  });
});

// review roughly on the card's own schedule, so repeated "Easy" grading doesn't degenerate
// elapsedDays into something absurd across the loop above.
function r_days(stability: number): number {
  return Math.max(1, Math.round(stability));
}
