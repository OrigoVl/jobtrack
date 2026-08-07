import type { ComponentType, SVGProps } from "react";

// Small line icons — originally just the Dashboard's stat tiles, now also the sidebar nav
// (App.tsx's NAV_DEF) and the command palette, replacing their emoji: the landing page's own
// visual language has no emoji anywhere, and the nav rail is on-screen on every single page, so
// it was the single biggest thing keeping the app from reading as "the same product" as the
// landing. Deliberately hand-rolled instead of pulling in an icon library (see CLAUDE.md's "don't
// add new dependencies" rule) — these are simple enough that a handful of paths is all that's
// needed. No color baked in: `stroke`/`fill` are "currentColor" so each caller controls color via
// className (e.g. `text-signal`), same as how `Spinner` in `ui.tsx` inherits color. Shared
// viewBox (0 0 18 18) and stroke weight (1.4, round caps/joins) across every icon here — keep new
// additions consistent with that, not just individually reasonable.
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Vacancies — briefcase. */
export function BriefcaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="1.5" y="5.5" width="15" height="10" rx="1.5" />
      <path d="M6.5 5.5V4a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 11.5 4v1.5" />
      <path d="M1.5 9.5h15" />
      <path d="M7.75 9.5h2.5" />
    </svg>
  );
}

/** Active vacancies — play/progress circle. */
export function PlayCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="9" cy="9" r="7.25" />
      <path d="M7.5 6.25 11.5 9l-4 2.75z" strokeLinejoin="round" />
    </svg>
  );
}

/** Interviews — calendar with a check. */
export function CalendarCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="1.5" y="3" width="15" height="13" rx="1.5" />
      <path d="M1.5 6.75h15" />
      <path d="M5 1.5v3M13 1.5v3" />
      <path d="M6.25 10.75 8 12.5l3.75-3.75" />
    </svg>
  );
}

/** Flashcards — stack of cards. */
export function CardsStackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="4" y="1.75" width="10" height="7" rx="1.25" transform="rotate(-8 9 5.25)" />
      <rect x="3" y="7" width="12" height="8.75" rx="1.5" />
      <path d="M6 11.25h6" />
    </svg>
  );
}

/** Streak — flame. */
export function FlameIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" fill="currentColor" stroke="none" aria-hidden="true" {...props}>
      <path d="M9 1.5c.4 2.1-.9 3-2 4.2-1.3 1.4-2 2.8-2 4.4a4.5 4.5 0 0 0 9 0c0-1.2-.4-2.1-1-2.9.1 1-.2 1.8-.9 2.2-.3-1.8-1.1-2.4-1.4-3.6-.2-1-.1-2.2-1.7-4.3Z" />
    </svg>
  );
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

/** Dashboard — house. */
export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M2 8.5 9 2.5l7 6" />
      <path d="M3.5 7.5V15a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V7.5" />
      <path d="M7 16v-5h4v5" />
    </svg>
  );
}

/** Job search — magnifying glass. */
export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M12.2 12.2 16 16" />
    </svg>
  );
}

/** Vacancy analysis — a document with a magnifier over it. */
export function FileSearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M5 1.75h5L13.5 5V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2.75a1 1 0 0 1 1-1Z" />
      <path d="M10 1.75V5h3.25" />
      <circle cx="7.75" cy="10.25" r="2.15" />
      <path d="M9.4 11.9 11 13.5" />
    </svg>
  );
}

/** Companies — office building. */
export function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <rect x="3" y="2" width="12" height="14" rx="1" />
      <path d="M6 5.5h1.5M10.5 5.5H12M6 9h1.5M10.5 9H12M6 12.5h1.5M10.5 12.5H12" />
    </svg>
  );
}

/** Contacts — two people. */
export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <circle cx="6.5" cy="6" r="2.5" />
      <path d="M2 15c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
      <circle cx="12.75" cy="6.5" r="2" />
      <path d="M11.25 11.2c1.9.3 3.5 1.6 3.5 3.8" />
    </svg>
  );
}

/** Analytics — bar chart. */
export function BarChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M2.5 15.5V3" />
      <path d="M2.5 15.5H16" />
      <rect x="4.5" y="10" width="2.2" height="5.5" rx="0.4" />
      <rect x="8.4" y="6.5" width="2.2" height="9" rx="0.4" />
      <rect x="12.3" y="9" width="2.2" height="6.5" rx="0.4" />
    </svg>
  );
}

/** Calendar (plain, no checkmark — distinct from CalendarCheckIcon's "interview scheduled" meaning). */
export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <rect x="1.5" y="3" width="15" height="13" rx="1.5" />
      <path d="M1.5 6.75h15" />
      <path d="M5 1.5v3M13 1.5v3" />
    </svg>
  );
}

/** Roadmap — a folded map with route fold-lines. */
export function MapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M6 3 2 4.5v10.5l4-1.5 5 1.5 5-1.5V3l-5 1.5z" />
      <path d="M6 3v10.5M11 4.5V15" />
    </svg>
  );
}

/** Intensive plan — a checklist. */
export function ListChecksIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M6.5 4.5h9M6.5 9h9M6.5 13.5h9" />
      <path d="M2 4.5l1 1 1.5-2M2 9l1 1 1.5-2M2 13.5l1 1 1.5-2" />
    </svg>
  );
}

/** Learning plan — an open book. */
export function BookOpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M9 4.5c-1.2-1-3-1.5-5-1.5-.6 0-1 .4-1 1v9c0-.6.4-1 1-1 2 0 3.8.6 5 1.5" />
      <path d="M9 4.5c1.2-1 3-1.5 5-1.5.6 0 1 .4 1 1v9c0-.6-.4-1-1-1-2 0-3.8.6-5 1.5" />
      <path d="M9 4.5v9" />
    </svg>
  );
}

/** Pet projects — stacked build layers. */
export function LayersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M9 2 2 6l7 4 7-4z" />
      <path d="M2 10l7 4 7-4" />
    </svg>
  );
}

/** Resources — a small library of book spines. */
export function LibraryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <rect x="2.5" y="2.5" width="3" height="13" rx="0.6" />
      <rect x="6.5" y="2.5" width="3" height="13" rx="0.6" />
      <path d="M11 3.2 14 15l-2.9.8-3-11.8z" />
    </svg>
  );
}

/** CV — a document with text lines. */
export function FileTextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M5 1.75h5.5L14 5.25V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2.75a1 1 0 0 1 1-1Z" />
      <path d="M10 1.75V5h3.5" />
      <path d="M6 9h6M6 11.5h6M6 6.5h2.5" />
    </svg>
  );
}

/** CV Builder — a wrench. */
export function WrenchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M11.8 3.2a3.5 3.5 0 0 0-4.6 4.2L2 12.6l2.4 2.4 5.2-5.2a3.5 3.5 0 0 0 4.2-4.6l-2.3 2.3-1.8-.6-.6-1.8z" />
    </svg>
  );
}

/** Account — a settings gear. */
export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 2.5v2M9 12.5v2M2.5 9h2M12.5 9h2M4.5 4.5l1.4 1.4M12.1 12.1l1.4 1.4M13.5 4.5l-1.4 1.4M5.9 12.1l-1.4 1.4" />
    </svg>
  );
}

/** Admin — a shield with a check. */
export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M9 1.5 15 4v5c0 4-2.7 6.6-6 8-3.3-1.4-6-4-6-8V4z" />
      <path d="M6.25 9 8.25 11 12 6.75" />
    </svg>
  );
}

/** Log out — a door with an arrow. */
export function LogOutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M7 2.5H3.5A1.5 1.5 0 0 0 2 4v10a1.5 1.5 0 0 0 1.5 1.5H7" />
      <path d="M11.5 12.5 15.5 9 11.5 5.5" />
      <path d="M6.5 9H15.5" />
    </svg>
  );
}

/** Light theme — sun. */
export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <circle cx="9" cy="9" r="3.25" />
      <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.6 3.6l1.4 1.4M13 13l1.4 1.4M14.4 3.6 13 5M5 13l-1.4 1.4" />
    </svg>
  );
}

/** Dark theme — moon. */
export function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M15.5 10.4A6.5 6.5 0 1 1 7.6 2.5a5.2 5.2 0 0 0 7.9 7.9Z" />
    </svg>
  );
}

/** Show password — open eye. */
export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M1.25 9C2.5 5.7 5.5 3.5 9 3.5s6.5 2.2 7.75 5.5C15.5 12.3 12.5 14.5 9 14.5S2.5 12.3 1.25 9Z" />
      <circle cx="9" cy="9" r="2.25" />
    </svg>
  );
}

/** Hide password — eye with a slash through it. */
export function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M1.25 9C2.5 5.7 5.5 3.5 9 3.5s6.5 2.2 7.75 5.5C15.5 12.3 12.5 14.5 9 14.5S2.5 12.3 1.25 9Z" />
      <path d="M2.5 2.5l13 13" />
    </svg>
  );
}

/** "Relevant to your gaps" marker — a small bullseye/target. */
export function TargetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <circle cx="9" cy="9" r="6.5" />
      <circle cx="9" cy="9" r="3.5" />
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A single person — CV photo placeholder (distinct from UsersIcon's two-person contacts mark). */
export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <circle cx="9" cy="6.25" r="3" />
      <path d="M3 15.5c0-3 2.7-5 6-5s6 2 6 5" />
    </svg>
  );
}

/** A chain link — "similar vacancies" toggle. */
export function LinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M7.5 10.5 10.5 7.5" />
      <path d="M8.5 5.3 10 3.8a2.6 2.6 0 0 1 3.7 3.7L12.2 9" />
      <path d="M9.5 12.7 8 14.2a2.6 2.6 0 0 1-3.7-3.7L5.8 9" />
    </svg>
  );
}

/** Expand to fullscreen — four corner brackets. */
export function ExpandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M6.5 1.5h-4a1 1 0 0 0-1 1v4" />
      <path d="M11.5 1.5h4a1 1 0 0 1 1 1v4" />
      <path d="M6.5 16.5h-4a1 1 0 0 1-1-1v-4" />
      <path d="M11.5 16.5h4a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

/** AI-improve action — a small four-point sparkle, the same "AI magic" motif as the Wordmark's
 * filled star glyph but drawn as a stroked line icon (matching this file's shared convention)
 * instead of a filled shape. Used on small per-item "improve this with AI" buttons. */
export function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M9 2 10.5 7.5 16 9 10.5 10.5 9 16 7.5 10.5 2 9 7.5 7.5Z" strokeLinejoin="round" />
    </svg>
  );
}

/** Native `<select>` affordance — paired with `appearance-none` on the select itself so every
 * dropdown in the app gets the same on-brand chevron instead of each OS/browser's own default
 * arrow glyph (see shared/ui.tsx's `Select`). */
export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M4.5 7 9 11.5 13.5 7" />
    </svg>
  );
}

/** Sidebar collapse/expand toggle — two stacked chevrons pointing left, matching the direction
 * the sidebar tucks away in (App.tsx's collapse button). Rotate 180° (`className="rotate-180"`)
 * for the "show sidebar again" direction instead of drawing a mirrored second icon. */
export function ChevronsLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M10 4 6 9l4 5" />
      <path d="M16 4l-4 5 4 5" />
    </svg>
  );
}

/** The mobile bottom bar's "More" entry (app/mobile-nav.tsx) — three dots, the near-universal
 * mobile convention for "the rest of the navigation lives behind this". Filled rather than
 * stroked: three 1.4-weight outlined circles at 18px read as fuzzy smudges, not dots. */
export function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" fill="currentColor" {...props}>
      <circle cx="4" cy="9" r="1.5" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="14" cy="9" r="1.5" />
    </svg>
  );
}

// --- Design-trainer canvas icons (design-canvas.tsx/design-node.tsx) — an Excalidraw-style
// icon-first toolbar/shape-library, filled variants (cursor/lightning) matching FlameIcon's
// convention above, everything else the file's shared outline style. ---

/** Select tool — a filled pointer/cursor arrow, the odd one out among the draw tools since a
 * thin outline reads poorly at this size (same reasoning as FlameIcon's filled treatment). */
export function CursorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" fill="currentColor" stroke="none" aria-hidden="true" {...props}>
      <path d="M3 2.2 14.5 8.6 9.6 9.9 12 15 10 15.9 7.7 10.8 3.8 13.3Z" />
    </svg>
  );
}

/** Freehand draw tool — a pencil. */
export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M11.5 2.5 15.5 6.5 6 16H2v-4Z" />
      <path d="M10 4 14 8" />
    </svg>
  );
}

/** Rectangle draw tool. */
export function RectangleToolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <rect x="2.5" y="4" width="13" height="10" rx="1.5" />
    </svg>
  );
}

/** Ellipse draw tool. */
export function EllipseToolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <ellipse cx="9" cy="9" rx="6.5" ry="5" />
    </svg>
  );
}

/** Arrow draw tool — a diagonal line with its arrowhead folded out of the same two strokes. */
export function ArrowToolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M3.5 14.5 14.5 3.5" />
      <path d="M8 3.5h6.5V10" />
    </svg>
  );
}

/** Text annotation tool — a capital "A". */
export function TypeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M9 2.5 4 15.5" />
      <path d="M9 2.5 14 15.5" />
      <path d="M6 11h6" />
    </svg>
  );
}

/** Destructive "clear canvas" action. */
export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M3.5 5h11" />
      <path d="M7 5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5" />
      <path d="M4.5 5 5.2 15a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9L13.5 5" />
      <path d="M7.5 8v5M10.5 8v5" />
    </svg>
  );
}

/** "Check my diagram" action — a checkmark in a ring. */
export function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <circle cx="9" cy="9" r="7" />
      <path d="M5.75 9.25 7.75 11.25 12.25 6.75" />
    </svg>
  );
}

/** Design node kind — client — a browser/monitor window. */
export function MonitorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <rect x="1.5" y="2.5" width="15" height="10" rx="1.2" />
      <path d="M6 15.5h6M9 12.5v3" />
    </svg>
  );
}

/** Design node kind — load balancer — one input fanning out to several outputs. */
export function SplitIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M2.5 9h3" />
      <path d="M5.5 9 12 4M5.5 9 12 9M5.5 9 12 14" />
      <circle cx="13.5" cy="4" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="9" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="14" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Design node kind — service/API — a "&lt;/&gt;" code glyph. */
export function ServerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M6.5 5 2.5 9l4 4" />
      <path d="M11.5 5 15.5 9l-4 4" />
    </svg>
  );
}

/** Design node kind — database — the classic cylinder glyph. */
export function DatabaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <ellipse cx="9" cy="4" rx="6.5" ry="2.2" />
      <path d="M2.5 4v10c0 1.2 2.9 2.2 6.5 2.2s6.5-1 6.5-2.2V4" />
      <path d="M2.5 9c0 1.2 2.9 2.2 6.5 2.2s6.5-1 6.5-2.2" />
    </svg>
  );
}

/** Design node kind — cache — a filled lightning bolt (fast/in-memory). */
export function ZapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" fill="currentColor" stroke="none" aria-hidden="true" {...props}>
      <path d="M10 1.5 3.5 10.5h4L7 16.5l7.5-9.5h-4Z" />
    </svg>
  );
}

/** Design node kind — queue — staggered bars, items moving through a line. */
export function QueueIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <rect x="2" y="3" width="10" height="3.2" rx="0.6" />
      <rect x="4" y="7.4" width="10" height="3.2" rx="0.6" />
      <rect x="6" y="11.8" width="10" height="3.2" rx="0.6" />
    </svg>
  );
}

/** Design node kind — CDN — a globe. */
export function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <circle cx="9" cy="9" r="7" />
      <path d="M2 9h14" />
      <path d="M9 2c2.2 2 3.4 4.4 3.4 7s-1.2 5-3.4 7c-2.2-2-3.4-4.4-3.4-7s1.2-5 3.4-7Z" />
    </svg>
  );
}

/** Design node kind — storage — an archive box. */
export function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <rect x="2" y="2.5" width="14" height="3.5" rx="1" />
      <path d="M3 6v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6" />
      <path d="M7 9.5h4" />
    </svg>
  );
}

/** Design node kind — third party — an external plug/connector. */
export function PlugIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M6 2.5v4M12 2.5v4" />
      <path d="M4.5 6.5h9v2.5a4.5 4.5 0 0 1-9 0Z" />
      <path d="M9 13.5V16" />
    </svg>
  );
}

/** Design node kind — generic — an unlabeled shape pair, for whatever doesn't fit the others. */
export function ShapesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <rect x="2" y="8" width="7" height="7" rx="1" />
      <circle cx="12.5" cy="6" r="4" />
    </svg>
  );
}

/** Reordering — one arrow up, one down. Replaced the ↕️ emoji on the CV Builder's "Section order"
 * accordion (cv/builder/layout-presets-panel.tsx): every OTHER section header in that column is
 * plain text, so a lone full-color emoji was the only thing on the page not drawn in this set's
 * line style. */
export function ArrowsUpDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M5.5 3v12M2.5 6l3-3 3 3" />
      <path d="M12.5 15V3M9.5 12l3 3 3-3" />
    </svg>
  );
}

/** Inline warning marker — the ⚠ glyph's replacement (roadmap.tsx's shared-track note, the CV
 * preview's "more than one page" hint). Color comes from the caller (`text-alert`), like every
 * other icon here. */
export function AlertTriangleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M9 2.5 16.5 15.5H1.5L9 2.5Z" />
      <path d="M9 7v3.5M9 13h.01" />
    </svg>
  );
}

/** Keyboard — the Roadmap node's "drills solved" chip (roadmap.tsx), where drills are the
 * type-the-code exercises. Replaced the ⌨ glyph, for the same reason as ArrowsUpDownIcon. */
export function KeyboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <rect x="1.5" y="4" width="15" height="10" rx="1.5" />
      <path d="M4.5 7h.01M7 7h.01M9.5 7h.01M12 7h.01M4.5 9.5h.01M7 9.5h.01M9.5 9.5h.01M12 9.5h.01" />
      <path d="M5.5 11.75h7" />
    </svg>
  );
}

/** Favorite toggle — star. Outline by default (`strokeProps`); pass `fill="currentColor"` at the
 * call site once favorited, same filled/outline convention as FlameIcon/CursorIcon above. */
export function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...strokeProps} {...props}>
      <path d="M9 1.8l2.19 4.44 4.9.71-3.55 3.46.84 4.88L9 12.9l-4.38 2.3.84-4.88-3.55-3.46 4.9-.71L9 1.8Z" />
    </svg>
  );
}
