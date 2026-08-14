// Contract test for the offline fallback (llmAvailable() === false must NEVER touch chatJson()),
// plus the dedup-against-existing-pool logic and FSRS grade bookkeeping — same mocking shape as
// mock-interview.service.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chatJson: vi.fn(),
}));

import {
  requestDrillHints,
  buildAvoidList,
  requestGeneratedDrills,
  dedupeGeneratedDrills,
  requestGeneratedCards,
  dedupeGeneratedCards,
  computeSrsGrade,
} from "./study.service.js";
import { llmAvailable, chatJson } from "../../llm/index.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";
import type { SrsRow } from "../../db/types.js";

describe("requestDrillHints()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offline: returns an empty terminal result without calling chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const result = await requestDrillHints(BOOTSTRAP_USER_ID, { cat: "JavaScript", lvl: "med", q: "Implement once(fn)" });
    expect(result).toEqual({ offline: true, hints: [] });
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("online: returns at most 3 hints from chatJson()'s response", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ hints: ["a", "b", "c", "d"] });
    const result = await requestDrillHints(BOOTSTRAP_USER_ID, { cat: "JavaScript", lvl: "med", q: "Implement once(fn)" });
    expect(result).toEqual({ offline: false, hints: ["a", "b", "c"] });
  });

  it("chatJson() returning null falls back to offline", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);
    const result = await requestDrillHints(BOOTSTRAP_USER_ID, { cat: "JavaScript", lvl: "med", q: "Implement once(fn)" });
    expect(result).toEqual({ offline: true, hints: [] });
  });
});

describe("requestGeneratedDrills()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offline: returns no items without calling chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const result = await requestGeneratedDrills(BOOTSTRAP_USER_ID, "Frontend Engineer", ["React"], "React", []);
    expect(result).toEqual({ offline: true, items: [] });
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("online: passes through the model's drills and uses the smart tier", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    const drills = [{ q: "Explain useMemo", lvl: "med" as const, sol: "...", exp: "..." }];
    vi.mocked(chatJson).mockResolvedValue({ drills });
    const result = await requestGeneratedDrills(BOOTSTRAP_USER_ID, "Frontend Engineer", ["React"], "React", []);
    expect(result).toEqual({ offline: false, items: drills });
    expect(vi.mocked(chatJson).mock.calls[0]![4]).toMatchObject({ tier: "smart", cache: true });
  });

  it("chatJson() returning null falls back to offline", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);
    const result = await requestGeneratedDrills(BOOTSTRAP_USER_ID, "Frontend Engineer", ["React"], "React", []);
    expect(result).toEqual({ offline: true, items: [] });
  });
});

describe("requestGeneratedCards()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offline: returns no items without calling chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const result = await requestGeneratedCards(BOOTSTRAP_USER_ID, "Frontend Engineer", "React", []);
    expect(result).toEqual({ offline: true, items: [] });
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("online: passes through the model's cards and uses the fast tier", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    const cards = [{ q: "What is useMemo?", a: "..." }];
    vi.mocked(chatJson).mockResolvedValue({ cards });
    const result = await requestGeneratedCards(BOOTSTRAP_USER_ID, "Frontend Engineer", "React", []);
    expect(result).toEqual({ offline: false, items: cards });
    expect(vi.mocked(chatJson).mock.calls[0]![4]).toMatchObject({ tier: "fast", cache: true });
  });
});

describe("buildAvoidList()", () => {
  it("caps at 40 questions and truncates each to 120 chars", () => {
    const long = "x".repeat(200);
    const existingQ = new Set(Array.from({ length: 50 }, (_, i) => `${long}-${i}`));
    const avoid = buildAvoidList(existingQ);
    expect(avoid).toHaveLength(40);
    for (const q of avoid) expect(q.length).toBeLessThanOrEqual(120);
  });
});

describe("dedupeGeneratedDrills()", () => {
  it("drops items whose question is already in the existing pool", () => {
    const items = [
      { q: "Already have this", lvl: "easy" as const, sol: "s1", exp: "e1" },
      { q: "Brand new question", lvl: "med" as const, sol: "s2", exp: "e2" },
    ];
    const existingQ = new Set(["Already have this"]);
    const added = dedupeGeneratedDrills(items, existingQ, "React", "React");
    expect(added).toEqual([{ cat: "React", lvl: "med", q: "Brand new question", sol: "s2", exp: "e2", generated: true, tech: "React" }]);
  });

  it("caps at `limit` BEFORE applying the dedup filter, matching the model's own ordering", () => {
    const items = [
      { q: "dup", lvl: "easy" as const, sol: "s", exp: "e" },
      { q: "new1", lvl: "easy" as const, sol: "s", exp: "e" },
      { q: "new2", lvl: "easy" as const, sol: "s", exp: "e" },
      { q: "new3", lvl: "easy" as const, sol: "s", exp: "e" },
    ];
    const existingQ = new Set(["dup"]);
    // limit=2: only the first 2 items ("dup","new1") are even considered, so at most 1 new entry
    // comes out even though "new2"/"new3" further down the list aren't duplicates.
    const added = dedupeGeneratedDrills(items, existingQ, "React", "React", 2);
    expect(added.map((d) => d.q)).toEqual(["new1"]);
  });

  it("does not mutate the caller's existingQ set", () => {
    const items = [{ q: "new", lvl: "easy" as const, sol: "s", exp: "e" }];
    const existingQ = new Set<string>();
    dedupeGeneratedDrills(items, existingQ, "React", "React");
    expect(existingQ.size).toBe(0);
  });

  it("dedupes within the same generated batch, not just against the existing pool", () => {
    const items = [
      { q: "same text", lvl: "easy" as const, sol: "s1", exp: "e1" },
      { q: "same text", lvl: "hard" as const, sol: "s2", exp: "e2" },
    ];
    const added = dedupeGeneratedDrills(items, new Set(), "React", "React");
    expect(added).toHaveLength(1);
  });
});

describe("dedupeGeneratedCards()", () => {
  it("drops items whose question is already in the existing pool, capped at `limit`", () => {
    const items = [
      { q: "already have", a: "a1" },
      { q: "new one", a: "a2" },
    ];
    const existingQ = new Set(["already have"]);
    const added = dedupeGeneratedCards(items, existingQ, "React");
    expect(added).toEqual([{ cat: "React", q: "new one", a: "a2", generated: true }]);
  });
});

describe("computeSrsGrade()", () => {
  it("a brand-new card (no prior grade) ignores lastReview/elapsedDays", () => {
    const now = new Date("2026-08-14T00:00:00.000Z");
    const result = computeSrsGrade(undefined, 3, now);
    expect(result.reps).toBe(1);
    expect(result.lastReview).toBe(now.toISOString());
    expect(result.due >= "2026-08-14").toBe(true);
    expect(result.difficulty).toBeGreaterThan(0);
    expect(result.stability).toBeGreaterThan(0);
  });

  it("increments reps and uses the previous difficulty/stability when the card was graded before", () => {
    const now = new Date("2026-08-14T00:00:00.000Z");
    const existing: SrsRow = {
      cardId: "c1",
      intervalDays: 4,
      due: "2026-08-14",
      reps: 2,
      difficulty: 5,
      stability: 4,
      lastReview: "2026-08-10T00:00:00.000Z",
    };
    const result = computeSrsGrade(existing, 3, now);
    expect(result.reps).toBe(3);
    expect(result.lastReview).toBe(now.toISOString());
    // Some review interval was scheduled forward from "now".
    expect(new Date(result.due).getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it("is deterministic given the same inputs", () => {
    const now = new Date("2026-08-14T00:00:00.000Z");
    const a = computeSrsGrade(undefined, 4, now);
    const b = computeSrsGrade(undefined, 4, now);
    expect(a).toEqual(b);
  });
});
