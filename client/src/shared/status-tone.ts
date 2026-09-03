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
  "Tech interview": "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  "Take-home task": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:border-fuchsia-800",
  Final: "bg-signal/10 text-signal border-signal/30",
  Offer: "bg-good/10 text-good border-good/30",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  Paused: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  // A distinct hue from Rejected (rose) and Paused (zinc): the posting itself disappeared from
  // the market, which isn't the same signal as "candidate was turned down" or "on hold for now".
  Removed: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
};

// Screening/Final use the vivid, theme-independent --star token (not the deepened --signal value)
// — a solid dot needs to read as bold indigo next to the equally-vivid sky-500/purple-500/
// fuchsia-500 dots, not as the muted, text-contrast-tuned shade. Offer gets its own --good green
// rather than reusing --star: it's the one genuinely positive outcome in the pipeline, and with
// --alert now equal to --signal (index.css's glossary — one accent, not two), Offer/Screening/
// Final would otherwise all render as the exact same indigo dot.
// "Tech interview" was violet-500 before the accent moved from coral to indigo — violet-500 sits
// only ~14° away from the new --star indigo on the hue wheel (they used to be worlds apart), so
// Screening/Tech-interview would have become nearly indistinguishable at dot size. purple-500
// splits the indigo→fuchsia gap far more evenly (~26°/~22° vs. violet's lopsided ~14°/~34°).
export const STATUS_DOT_CLASS: Record<VacancyStatus, string> = {
  "Want to apply": "bg-ink-dim",
  Applied: "bg-sky-500",
  Screening: "bg-star",
  "Tech interview": "bg-purple-500",
  "Take-home task": "bg-fuchsia-500",
  Final: "bg-star",
  Offer: "bg-good",
  Rejected: "bg-rose-500",
  Paused: "bg-zinc-400",
  Removed: "bg-amber-500",
};

// Same color as STATUS_DOT_CLASS, but as the card's left border in the Kanban board — so status
// still reads even when the column is scrolled off-screen.
export const STATUS_BORDER_L_CLASS: Record<VacancyStatus, string> = {
  "Want to apply": "border-l-ink-dim",
  Applied: "border-l-sky-500",
  Screening: "border-l-star",
  "Tech interview": "border-l-purple-500",
  "Take-home task": "border-l-fuchsia-500",
  Final: "border-l-star",
  Offer: "border-l-good",
  Rejected: "border-l-rose-500",
  Paused: "border-l-zinc-400",
  Removed: "border-l-amber-500",
};

// Fallback just in case: status on Vacancy is typed as string (the server has historically
// accepted arbitrary strings), so indexing by an unknown value must not throw or leave an empty class.
export const DEFAULT_STATUS_SELECT_CLASS = "bg-surface-2 text-ink border-grid";
export const DEFAULT_STATUS_DOT_CLASS = "bg-ink-dim";
export const DEFAULT_STATUS_BORDER_L_CLASS = "border-l-ink-dim";
