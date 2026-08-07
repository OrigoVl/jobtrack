import { STATUSES, type Fit, type Vacancy, type VacancyStatus } from "../../shared/types";

export type SortKey = "default" | "company" | "fit" | "status" | "applied" | "next" | "created";
const FIT_ORDER: Record<Fit, number> = { high: 3, med: 2, low: 1 };

export type ColumnKey = "stack" | "fit" | "salary" | "contacts" | "applied" | "next" | "created";
// A Record (not a template literal), same trick as roadmap.tsx's STATUS_LABEL_KEY — keeps every
// value a literal key i18next's typed t() can verify, even though it's looked up at runtime by
// a dynamically-toggled column key.
export const COLUMN_LABEL_KEY: Record<
  ColumnKey,
  "table.stack" | "table.fit" | "table.salary" | "table.contacts" | "table.applied" | "table.nextStep" | "table.created"
> = {
  stack: "table.stack",
  fit: "table.fit",
  salary: "table.salary",
  contacts: "table.contacts",
  applied: "table.applied",
  next: "table.nextStep",
  created: "table.created",
};
export const OPTIONAL_COLUMNS: ColumnKey[] = ["stack", "fit", "salary", "contacts", "applied", "next", "created"];

/** Filters + sorts the table view client-side — the full list is already loaded (no pagination),
 * so there's no reason to round-trip to the server for either. `sortBy: "default"` keeps the
 * server's own `ORDER BY id DESC` (newest first) instead of reshuffling the list before the user
 * has ever touched a column header. */
export function filterAndSortVacancies(
  vacancies: Vacancy[],
  {
    search,
    status,
    fit,
    favoritesOnly,
    sortBy,
    sortDir,
  }: { search: string; status: string; fit: string; favoritesOnly: boolean; sortBy: SortKey; sortDir: "asc" | "desc" },
): Vacancy[] {
  const q = search.trim().toLowerCase();
  const filtered = vacancies.filter((v) => {
    if (favoritesOnly && !v.favorite) return false;
    if (status !== "all" && v.status !== status) return false;
    if (fit !== "all" && v.fit !== fit) return false;
    if (q && !`${v.company} ${v.position} ${v.stack.join(" ")} ${v.notes}`.toLowerCase().includes(q)) return false;
    return true;
  });
  if (sortBy === "default") return filtered;
  const dir = sortDir === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "company":
        return dir * a.company.localeCompare(b.company);
      case "fit":
        return dir * (FIT_ORDER[a.fit] - FIT_ORDER[b.fit]);
      case "status":
        return dir * (STATUSES.indexOf(a.status as VacancyStatus) - STATUSES.indexOf(b.status as VacancyStatus));
      case "applied":
        return dir * a.applied.localeCompare(b.applied);
      case "next":
        return dir * a.next.localeCompare(b.next);
      case "created":
        return dir * (a.created ?? "").localeCompare(b.created ?? "");
    }
  });
}
