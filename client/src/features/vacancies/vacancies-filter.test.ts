import { describe, expect, it } from "vitest";
import { filterAndSortVacancies } from "./vacancies-filter";
import type { Vacancy } from "../../shared/types";

function vacancy(overrides: Partial<Vacancy> = {}): Vacancy {
  return {
    id: 1,
    company: "Acme",
    companyId: null,
    position: "Engineer",
    level: "",
    salary: "",
    url: "",
    status: "Want to apply",
    fit: "med",
    applied: "",
    next: "",
    nextAction: "",
    notes: "",
    stack: [],
    favorite: false,
    coverLetter: "",
    coverLetterDetails: "",
    ...overrides,
  };
}

const noFilter = {
  search: "",
  status: [] as string[],
  fit: [] as string[],
  favoritesOnly: false,
  sortBy: "default" as const,
  sortDir: "asc" as const,
};

describe("filterAndSortVacancies", () => {
  it("keeps the original (server) order when sortBy is 'default'", () => {
    const rows = [vacancy({ id: 1, company: "Zeta" }), vacancy({ id: 2, company: "Alpha" })];
    expect(filterAndSortVacancies(rows, noFilter).map((v) => v.id)).toEqual([1, 2]);
  });

  it("filters by a single status", () => {
    const rows = [vacancy({ id: 1, status: "Applied" }), vacancy({ id: 2, status: "Rejected" })];
    const out = filterAndSortVacancies(rows, { ...noFilter, status: ["Rejected"] });
    expect(out.map((v) => v.id)).toEqual([2]);
  });

  it("filters by several statuses at once (OR within the category)", () => {
    const rows = [vacancy({ id: 1, status: "Applied" }), vacancy({ id: 2, status: "Screening" }), vacancy({ id: 3, status: "Rejected" })];
    const out = filterAndSortVacancies(rows, { ...noFilter, status: ["Applied", "Screening"] });
    expect(out.map((v) => v.id)).toEqual([1, 2]);
  });

  it("filters by a single fit", () => {
    const rows = [vacancy({ id: 1, fit: "high" }), vacancy({ id: 2, fit: "low" })];
    expect(filterAndSortVacancies(rows, { ...noFilter, fit: ["high"] }).map((v) => v.id)).toEqual([1]);
  });

  it("filters by several fit levels at once (OR within the category)", () => {
    const rows = [vacancy({ id: 1, fit: "high" }), vacancy({ id: 2, fit: "med" }), vacancy({ id: 3, fit: "low" })];
    expect(filterAndSortVacancies(rows, { ...noFilter, fit: ["high", "low"] }).map((v) => v.id)).toEqual([1, 3]);
  });

  it("ANDs status and fit together when both categories have a selection", () => {
    const rows = [
      vacancy({ id: 1, status: "Applied", fit: "high" }),
      vacancy({ id: 2, status: "Applied", fit: "low" }),
      vacancy({ id: 3, status: "Rejected", fit: "high" }),
    ];
    const out = filterAndSortVacancies(rows, { ...noFilter, status: ["Applied"], fit: ["high"] });
    expect(out.map((v) => v.id)).toEqual([1]);
  });

  it("filters to favorites only", () => {
    const rows = [vacancy({ id: 1, favorite: true }), vacancy({ id: 2, favorite: false })];
    expect(filterAndSortVacancies(rows, { ...noFilter, favoritesOnly: true }).map((v) => v.id)).toEqual([1]);
    expect(filterAndSortVacancies(rows, { ...noFilter, favoritesOnly: false }).map((v) => v.id)).toEqual([1, 2]);
  });

  it("searches across company, position, stack, and notes (case-insensitive)", () => {
    const rows = [
      vacancy({ id: 1, company: "Acme", stack: ["React"] }),
      vacancy({ id: 2, company: "Other", position: "backend REACT dev" }),
      vacancy({ id: 3, company: "Other", notes: "mentions react in notes" }),
      vacancy({ id: 4, company: "Nope", position: "Nothing", stack: ["Vue"], notes: "unrelated" }),
    ];
    const out = filterAndSortVacancies(rows, { ...noFilter, search: "react" });
    expect(out.map((v) => v.id)).toEqual([1, 2, 3]);
  });

  it("sorts by company alphabetically, respecting direction", () => {
    const rows = [vacancy({ id: 1, company: "Zeta" }), vacancy({ id: 2, company: "Alpha" })];
    expect(filterAndSortVacancies(rows, { ...noFilter, sortBy: "company", sortDir: "asc" }).map((v) => v.company)).toEqual([
      "Alpha",
      "Zeta",
    ]);
    expect(filterAndSortVacancies(rows, { ...noFilter, sortBy: "company", sortDir: "desc" }).map((v) => v.company)).toEqual([
      "Zeta",
      "Alpha",
    ]);
  });

  it("sorts by fit as high > med > low", () => {
    const rows = [vacancy({ id: 1, fit: "low" }), vacancy({ id: 2, fit: "high" }), vacancy({ id: 3, fit: "med" })];
    expect(filterAndSortVacancies(rows, { ...noFilter, sortBy: "fit", sortDir: "desc" }).map((v) => v.fit)).toEqual(["high", "med", "low"]);
  });

  it("sorts by status in the pipeline's own order (not alphabetically)", () => {
    const rows = [vacancy({ id: 1, status: "Offer" }), vacancy({ id: 2, status: "Want to apply" })];
    // "Want to apply" comes before "Offer" in STATUSES (shared/types.ts), not alphabetically.
    expect(filterAndSortVacancies(rows, { ...noFilter, sortBy: "status", sortDir: "asc" }).map((v) => v.status)).toEqual([
      "Want to apply",
      "Offer",
    ]);
  });

  it("sorts by applied/next date strings", () => {
    const rows = [vacancy({ id: 1, applied: "2026-02-01" }), vacancy({ id: 2, applied: "2026-01-01" })];
    expect(filterAndSortVacancies(rows, { ...noFilter, sortBy: "applied", sortDir: "asc" }).map((v) => v.id)).toEqual([2, 1]);
  });

  it("combines filtering and sorting", () => {
    const rows = [
      vacancy({ id: 1, status: "Applied", company: "Zeta" }),
      vacancy({ id: 2, status: "Applied", company: "Alpha" }),
      vacancy({ id: 3, status: "Rejected", company: "Beta" }),
    ];
    const out = filterAndSortVacancies(rows, { ...noFilter, status: ["Applied"], sortBy: "company", sortDir: "asc" });
    expect(out.map((v) => v.company)).toEqual(["Alpha", "Zeta"]);
  });
});
