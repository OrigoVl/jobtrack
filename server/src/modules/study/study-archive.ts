// Append-only log of solved drill tasks — snapshots q/sol/exp at solve time so generated
// drills remain reviewable even if they drop out of genDrills later.
import type { DrillItem } from "./content.js";

/** GET /study/archive — newest first, capped server-side. */
export interface DrillArchiveEntry {
  id: string;
  drillId: string;
  cat: string;
  lvl: string;
  q: string;
  sol: string;
  exp: string;
  generated?: boolean;
  tech?: string;
  solvedAt: string;
}

export const MAX_DRILL_ARCHIVE = 100;

export function drillArchiveEntryFromDrill(drill: DrillItem, solvedAt: string): DrillArchiveEntry {
  return {
    id: `drill-arch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    drillId: drill.id,
    cat: drill.cat,
    lvl: drill.lvl,
    q: drill.q,
    sol: drill.sol,
    exp: drill.exp,
    ...(drill.generated ? { generated: true } : {}),
    ...(drill.tech ? { tech: drill.tech } : {}),
    solvedAt,
  };
}

/** Prepends or re-promotes an entry (same drillId → update snapshot + solvedAt), then caps. */
export function appendDrillArchive(history: DrillArchiveEntry[], entry: DrillArchiveEntry): DrillArchiveEntry[] {
  const without = history.filter((e) => e.drillId !== entry.drillId);
  return [entry, ...without].slice(0, MAX_DRILL_ARCHIVE);
}

export function removeDrillArchiveEntry(history: DrillArchiveEntry[], id: string): DrillArchiveEntry[] {
  return history.filter((e) => e.id !== id);
}

export type DrillArchiveEditableFields = Pick<DrillArchiveEntry, "q" | "sol" | "exp">;

/** Edits the reviewable content (question/solution/explanation) of an existing entry — id/drillId/
 * solvedAt/etc. are left untouched, this isn't a re-solve. Returns null if `id` isn't found, so the
 * route can 404 instead of silently no-op'ing. */
export function updateDrillArchiveEntry(
  history: DrillArchiveEntry[],
  id: string,
  patch: Partial<DrillArchiveEditableFields>,
): DrillArchiveEntry[] | null {
  if (!history.some((e) => e.id === id)) return null;
  return history.map((e) => (e.id === id ? { ...e, ...patch } : e));
}
