import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700",
  ghost: "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200",
  subtle: "bg-transparent text-slate-600 hover:bg-slate-100",
  danger: "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100",
};
const SIZE: Record<Size, string> = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };

/** A small SVG spinner (Tailwind `animate-spin`) — for buttons and inline "saving/loading" indicators. */
export function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function Btn({
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  disabled,
  children,
  ...rest
}: { variant?: Variant; size?: Size; loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {loading && <Spinner className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      {children}
    </button>
  );
}

export function Card({ className = "", children, ...rest }: { className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`rounded-2xl bg-white border border-slate-200 shadow-card p-4 md:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 flex-wrap">
      <div className="min-w-0">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="ml-auto flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

const CHIP_TONE = {
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
} as const;

export function Chip({ tone = "slate", children }: { tone?: keyof typeof CHIP_TONE; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${CHIP_TONE[tone]}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, max, tone = "indigo" }: { value: number; max: number; tone?: "indigo" | "emerald" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = tone === "emerald" ? "bg-emerald-500" : "bg-indigo-600";
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-semibold text-slate-800">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1 max-w-md">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  size = "sm",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";
  return (
    <div className="inline-flex rounded-lg bg-slate-100 border border-slate-200 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`${pad} rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${value === o.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Animates open/close of arbitrary content by transitioning a measured pixel `height` (not
 * `grid-template-rows`'s "0fr ⇄ 1fr" trick — animating between `fr` track sizes turned out to
 * not actually interpolate in every Chromium build we test against; it silently freezes at the
 * old value instead of collapsing). Content stays mounted while closed (clipped by
 * `overflow-hidden` + `height: 0`) so the CLOSING transition is visible too, not just an instant
 * unmount; `aria-hidden` + `pointer-events-none` keep it out of screen readers/clicks while
 * collapsed. Once fully open, height is released to `"auto"` so content that grows afterward
 * (e.g. typing a longer bullet into a still-open Experience entry) isn't clipped at the
 * originally-measured height. Shared by `Section` below and any other custom-styled toggle that
 * wants the same effect (e.g. one experience entry expanding in `ExperienceCard`). */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(open ? "auto" : 0);
  // Skip animating the very first render — `height` above already matches `open` at mount, so
  // there's nothing to transition. Deliberately NOT a "have we mounted yet" boolean reset in a
  // cleanup function: React calls a layout effect's cleanup before every re-run, not just on a
  // true unmount, so a boolean flip back to `false` there would also swallow the very next
  // *real* toggle (it'd look identical to "still mid-mount" and skip re-measuring the height).
  // Comparing against the last `open` value this effect actually reacted to sidesteps that: React
  // 18 StrictMode's dev-only synthetic mount→unmount→mount replay re-invokes this effect with the
  // exact same `open` it started with (not a real prop change), so the comparison still reads
  // "unchanged" on that second call and skips correctly either way.
  const lastOpenRef = useRef(open);

  useLayoutEffect(() => {
    if (lastOpenRef.current === open) return;
    lastOpenRef.current = open;
    const el = ref.current;
    if (!el) return;
    if (open) {
      setHeight(el.scrollHeight);
    } else {
      // Can't transition FROM "auto" — snap to the equivalent concrete pixel height first, then
      // collapse to 0. The snap has to land in an already-painted frame *before* the 0 for the
      // browser to have a real start point to animate from — done here via a direct (bypassing
      // React state) write + a forced synchronous reflow (`offsetHeight` read), not a
      // requestAnimationFrame callback deferring the second step to "next paint": some embedded/
      // backgrounded browser views (e.g. an inactive devtools-hosted tab) never actually schedule
      // a paint for such a callback to fire on, which would leave this stuck at the snapped
      // height forever instead of collapsing.
      el.style.height = `${el.scrollHeight}px`;
      void el.offsetHeight;
      setHeight(0);
    }
  }, [open]);

  return (
    <div
      ref={ref}
      aria-hidden={!open}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      className={`overflow-hidden transition-[height] duration-300 ease-in-out ${open ? "" : "pointer-events-none"}`}
      onTransitionEnd={(e) => {
        // Only release to "auto" once OUR height transition (not a descendant's, e.g. a
        // spinner icon) finishes opening — otherwise later growth would stay clipped forever.
        if (e.target === ref.current && e.propertyName === "height" && open) setHeight("auto");
      }}
    >
      <div className={`transition-opacity ${open ? "opacity-100 duration-300 delay-100" : "opacity-0 duration-150"}`}>{children}</div>
    </div>
  );
}

export function Section({
  title,
  icon,
  defaultOpen = false,
  open: openProp,
  onToggle,
  hint,
  bare = false,
  children,
}: {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  /** Controlled open state (e.g. for an exclusive accordion group) — omit to let the section
   * manage its own open/closed state internally (the original, independent-toggle behavior). */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  hint?: string;
  /** Lighter look (no border/shadow-bearing card, just spacing) — for nesting inside another
   * bordered container (e.g. one top-level accordion item) instead of stacking borders. */
  bare?: boolean;
  children: ReactNode;
}) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const toggle = () => (onToggle ? onToggle(!open) : setOpenState((v) => !v));
  return (
    <div className={bare ? "" : "rounded-xl border border-slate-200 bg-white overflow-hidden"}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`w-full flex items-center gap-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${bare ? "py-2" : "px-3.5 py-2.5"}`}
      >
        {icon && <span aria-hidden>{icon}</span>}
        <span>{title}</span>
        {hint && <span className="text-xs font-normal text-slate-400 truncate">· {hint}</span>}
        <span className={`ml-auto text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} aria-hidden>
          ›
        </span>
      </button>
      <Collapse open={open}>
        <div className={`space-y-3 ${bare ? "pb-3 pt-1" : "px-3.5 pb-3.5 pt-1 border-t border-slate-100"}`}>{children}</div>
      </Collapse>
    </div>
  );
}

/** A button that opens an absolutely-positioned panel below it — closes on outside click/Escape.
 * Used to group several related actions under one header button (e.g. "Import ▾") instead of a
 * row of equal-weight buttons. */
export function Dropdown({ label, align = "left", children }: { label: ReactNode; align?: "left" | "right"; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <Btn size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label} <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </Btn>
      {open && (
        // This div is a plain click-delegation wrapper — it has no interactive semantics of
        // its own (the actual buttons/links/inputs inside it already have their own keyboard
        // support); it only auto-closes the panel once *any* of those is activated, like a
        // native <select> closing after picking an option.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          className={`absolute z-20 mt-1 min-w-[220px] rounded-xl bg-white border border-slate-200 shadow-lg p-2 space-y-1 ${align === "right" ? "right-0" : "left-0"}`}
          onClick={(e) => {
            // Let items opt out via data-keep-open (e.g. a text input) — anything else inside
            // the panel closes the dropdown once clicked, same as a native <select>.
            if (!(e.target as HTMLElement).closest("[data-keep-open]")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}
