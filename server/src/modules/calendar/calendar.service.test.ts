import { describe, expect, it } from "vitest";
import { buildVacancyNextSteps, buildSrsDueDays } from "./calendar.service.js";
import type { VacancyRow } from "../../db/types.js";
import type { SrsRow } from "../../db/types.js";
import type { Card } from "../study/content.js";

function vacancy(overrides: Partial<VacancyRow> = {}): VacancyRow {
  return {
    id: 1,
    company: "Acme",
    position: "Engineer",
    level: "",
    salary: "",
    url: "",
    status: "Applied",
    fit: "med",
    applied: "",
    next: "",
    notes: "",
    stack: [],
    created: "2026-01-01",
    companyId: null,
    favorite: false,
    coverLetter: "",
    coverLetterDetails: "",
    ...overrides,
  };
}

function srsRow(overrides: Partial<SrsRow> = {}): SrsRow {
  return { cardId: "c1", intervalDays: 1, due: "2026-08-01", reps: 1, difficulty: 5, stability: 3, lastReview: null, ...overrides };
}

describe("buildVacancyNextSteps", () => {
  it("only includes vacancies with a `next` date set", () => {
    const rows = [vacancy({ id: 1, next: "2026-08-05" }), vacancy({ id: 2, next: "" })];
    expect(buildVacancyNextSteps(rows)).toEqual([{ vacancyId: 1, company: "Acme", position: "Engineer", date: "2026-08-05" }]);
  });

  it("sorts by date ascending", () => {
    const rows = [vacancy({ id: 1, next: "2026-08-20" }), vacancy({ id: 2, next: "2026-08-05" })];
    expect(buildVacancyNextSteps(rows).map((s) => s.vacancyId)).toEqual([2, 1]);
  });

  it("filters by an inclusive from/to range", () => {
    const rows = [vacancy({ id: 1, next: "2026-07-31" }), vacancy({ id: 2, next: "2026-08-05" }), vacancy({ id: 3, next: "2026-08-31" })];
    const result = buildVacancyNextSteps(rows, { from: "2026-08-01", to: "2026-08-10" });
    expect(result.map((s) => s.vacancyId)).toEqual([2]);
  });
});

describe("buildSrsDueDays", () => {
  it("groups cards by their recorded due date", () => {
    const cards: Card[] = [
      { id: "a", cat: "js", q: "?", a: "!" },
      { id: "b", cat: "js", q: "?", a: "!" },
      { id: "c", cat: "js", q: "?", a: "!" },
    ];
    const state: Record<string, SrsRow> = {
      a: srsRow({ cardId: "a", due: "2026-08-01" }),
      b: srsRow({ cardId: "b", due: "2026-08-01" }),
      c: srsRow({ cardId: "c", due: "2026-08-02" }),
    };
    expect(buildSrsDueDays(cards, state)).toEqual([
      { date: "2026-08-01", count: 2 },
      { date: "2026-08-02", count: 1 },
    ]);
  });

  it("excludes cards with no SRS state — never reviewed means no real due date, not a fabricated one", () => {
    const cards: Card[] = [{ id: "new-card", cat: "js", q: "?", a: "!" }];
    expect(buildSrsDueDays(cards, {})).toEqual([]);
  });

  it("filters by an inclusive from/to range", () => {
    const cards: Card[] = [
      { id: "a", cat: "js", q: "?", a: "!" },
      { id: "b", cat: "js", q: "?", a: "!" },
    ];
    const state: Record<string, SrsRow> = {
      a: srsRow({ cardId: "a", due: "2026-07-01" }),
      b: srsRow({ cardId: "b", due: "2026-08-01" }),
    };
    expect(buildSrsDueDays(cards, state, { from: "2026-08-01" })).toEqual([{ date: "2026-08-01", count: 1 }]);
  });
});
