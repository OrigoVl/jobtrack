// Color progression for vacancy status — from neutral (not yet applied) through cool tones
// (in progress) to warm tones (close to the end), plus separate green/red/gray for clear
// endings (offer/rejected/paused). Used both in the table (the <select> background) and in
// the Kanban board (the column's color indicator), so status reads at a glance without hovering.
import type { VacancyStatus } from "./types";

export const STATUS_SELECT_CLASS: Record<VacancyStatus, string> = {
  "Want to apply": "bg-slate-100 text-slate-700 border-slate-200",
  Applied: "bg-sky-50 text-sky-700 border-sky-200",
  Screening: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Tech interview": "bg-violet-50 text-violet-700 border-violet-200",
  "Take-home task": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  Final: "bg-amber-50 text-amber-700 border-amber-200",
  Offer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
  Paused: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export const STATUS_DOT_CLASS: Record<VacancyStatus, string> = {
  "Want to apply": "bg-slate-400",
  Applied: "bg-sky-500",
  Screening: "bg-indigo-500",
  "Tech interview": "bg-violet-500",
  "Take-home task": "bg-fuchsia-500",
  Final: "bg-amber-500",
  Offer: "bg-emerald-500",
  Rejected: "bg-rose-500",
  Paused: "bg-zinc-400",
};

// Same color as STATUS_DOT_CLASS, but as the card's left border in the Kanban board — so status
// still reads even when the column is scrolled off-screen.
export const STATUS_BORDER_L_CLASS: Record<VacancyStatus, string> = {
  "Want to apply": "border-l-slate-400",
  Applied: "border-l-sky-500",
  Screening: "border-l-indigo-500",
  "Tech interview": "border-l-violet-500",
  "Take-home task": "border-l-fuchsia-500",
  Final: "border-l-amber-500",
  Offer: "border-l-emerald-500",
  Rejected: "border-l-rose-500",
  Paused: "border-l-zinc-400",
};

// Fallback just in case: status on Vacancy is typed as string (the server has historically
// accepted arbitrary strings), so indexing by an unknown value must not throw or leave an empty class.
export const DEFAULT_STATUS_SELECT_CLASS = "bg-slate-100 text-slate-700 border-slate-200";
export const DEFAULT_STATUS_DOT_CLASS = "bg-slate-400";
export const DEFAULT_STATUS_BORDER_L_CLASS = "border-l-slate-400";
