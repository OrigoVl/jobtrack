// Color progression for vacancy status — from neutral (not yet applied) through cool tones
// (in progress) to warm tones (close to the end), plus separate green/red/gray for clear
// endings (offer/rejected/paused). Used both in the table (the <select> background) and in
// the Kanban board (the column's color indicator), so status reads at a glance without hovering.
import type { VacancyStatus } from "./types";

// bg-*-50/text-*-700 pairs are light-mode-only (no CSS-variable token for these pipeline-stage
// colors, see the file header) — each needs an explicit dark: variant, or it renders as a pale,
// near-white block against the dark surface instead of a subtle tinted one.
export const STATUS_SELECT_CLASS: Record<VacancyStatus, string> = {
  "Want to apply": "bg-surface-2 text-ink border-grid",
  Applied: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  Screening: "bg-signal/10 text-signal border-signal/30",
  "Tech interview": "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  "Take-home task": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:border-fuchsia-800",
  Final: "bg-alert/10 text-alert border-alert/30",
  Offer: "bg-signal/10 text-signal border-signal/30",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  Paused: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

export const STATUS_DOT_CLASS: Record<VacancyStatus, string> = {
  "Want to apply": "bg-ink-dim",
  Applied: "bg-sky-500",
  Screening: "bg-signal",
  "Tech interview": "bg-violet-500",
  "Take-home task": "bg-fuchsia-500",
  Final: "bg-alert",
  Offer: "bg-signal",
  Rejected: "bg-rose-500",
  Paused: "bg-zinc-400",
};

// Same color as STATUS_DOT_CLASS, but as the card's left border in the Kanban board — so status
// still reads even when the column is scrolled off-screen.
export const STATUS_BORDER_L_CLASS: Record<VacancyStatus, string> = {
  "Want to apply": "border-l-ink-dim",
  Applied: "border-l-sky-500",
  Screening: "border-l-signal",
  "Tech interview": "border-l-violet-500",
  "Take-home task": "border-l-fuchsia-500",
  Final: "border-l-alert",
  Offer: "border-l-signal",
  Rejected: "border-l-rose-500",
  Paused: "border-l-zinc-400",
};

// Fallback just in case: status on Vacancy is typed as string (the server has historically
// accepted arbitrary strings), so indexing by an unknown value must not throw or leave an empty class.
export const DEFAULT_STATUS_SELECT_CLASS = "bg-surface-2 text-ink border-grid";
export const DEFAULT_STATUS_DOT_CLASS = "bg-ink-dim";
export const DEFAULT_STATUS_BORDER_L_CLASS = "border-l-ink-dim";
