// Append-only log of graded system-design tasks — unlike designHistory (score + title only, feeds
// computeDesignLevel's progression indicator), this snapshots the full task/diagram/grade at grade
// time so a past exercise remains fully reviewable (task text + diagram + feedback), not just a
// score in a list. Same append-and-cap shape as study/study-archive.ts's drill archive.
import type { DesignDiagram, DesignGrade, DesignTask } from "./design.service.js";

export interface DesignArchiveEntry {
  id: string;
  task: DesignTask;
  diagram: DesignDiagram;
  grade: DesignGrade;
  gradedAt: string;
}

export const MAX_DESIGN_ARCHIVE = 50;

export function designArchiveEntryFromGrade(
  task: DesignTask,
  diagram: DesignDiagram,
  grade: DesignGrade,
  gradedAt: string,
): DesignArchiveEntry {
  return {
    id: `design-arch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    task,
    diagram,
    grade,
    gradedAt,
  };
}

/** Prepends the newest entry and caps the list — every grade is its own entry (unlike the drill
 * archive, there's no natural "same task" id to re-promote on: every /design/task call generates a
 * fresh task, so re-grading the same exercise multiple times is intentionally kept as separate
 * history rather than collapsed). */
export function appendDesignArchive(history: DesignArchiveEntry[], entry: DesignArchiveEntry): DesignArchiveEntry[] {
  return [entry, ...history].slice(0, MAX_DESIGN_ARCHIVE);
}

export function removeDesignArchiveEntry(history: DesignArchiveEntry[], id: string): DesignArchiveEntry[] {
  return history.filter((e) => e.id !== id);
}

export type DesignArchiveEditableFields = {
  title: string;
  scenario: string;
  summary: string;
  tip: string;
};

/** Edits the reviewable text of an existing entry (task title/scenario, grade summary/tip) — the
 * diagram and structured criteria/requirements are left as originally graded, this isn't a re-grade.
 * Returns null if `id` isn't found, so the route can 404 instead of silently no-op'ing. */
export function updateDesignArchiveEntry(
  history: DesignArchiveEntry[],
  id: string,
  patch: Partial<DesignArchiveEditableFields>,
): DesignArchiveEntry[] | null {
  if (!history.some((e) => e.id === id)) return null;
  return history.map((e) => {
    if (e.id !== id) return e;
    return {
      ...e,
      task:
        patch.title != null || patch.scenario != null
          ? {
              ...e.task,
              ...(patch.title != null ? { title: patch.title } : {}),
              ...(patch.scenario != null ? { scenario: patch.scenario } : {}),
            }
          : e.task,
      grade:
        patch.summary != null || patch.tip != null
          ? { ...e.grade, ...(patch.summary != null ? { summary: patch.summary } : {}), ...(patch.tip != null ? { tip: patch.tip } : {}) }
          : e.grade,
    };
  });
}
