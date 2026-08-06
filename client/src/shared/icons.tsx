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
