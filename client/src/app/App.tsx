import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from "react-router";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ToastProvider } from "../shared/toast";
import { useToast } from "../shared/use-toast";
import { ConfirmDialogProvider } from "../shared/confirm";
import { useHealth, useRoadmap, useBilling, useOnboardingState, useClaimReferral } from "../shared/queries";
import { CardsSkeleton, ProgressBar, Btn, Wordmark } from "../shared/ui";
import { useUi } from "../shared/ui-state";
import { CelebrationOverlay } from "../shared/celebration";
import { FetchAllJobNotifier } from "../shared/fetch-all-notifier";
import { CvAuditJobNotifier } from "../shared/cv-audit-notifier";
import { AiQuotaNotifier } from "../shared/ai-quota-notifier";
import { CalendarReminderNotifier } from "../features/calendar/calendar-reminder-notifier";
import { LanguageSwitcher } from "../shared/language-switcher";
import { ThemeSwitcher } from "../shared/theme-switcher";
import { ErrorBoundary } from "../shared/error-boundary";
import { useSession, signOut } from "../shared/auth-client";
import { takeStoredReferralCode } from "../shared/referral-storage";
import { CommandPalette } from "./command-palette";
import { SectionTabs } from "./section-tabs";
import { MobileNav } from "./mobile-nav";
import { NotFound } from "./not-found";
import { storeRoadmapView, type RoadmapView } from "../features/roadmap/roadmap-view";
import {
  BarChartIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  BookOpenIcon,
  CardsStackIcon,
  ChevronsLeftIcon,
  FileSearchIcon,
  FileTextIcon,
  HomeIcon,
  LayersIcon,
  ListChecksIcon,
  LibraryIcon,
  LogOutIcon,
  MapIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  WrenchIcon,
  type IconComponent,
} from "../shared/icons";

const Login = lazy(() => import("../features/auth/login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("../features/auth/register").then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import("../features/auth/forgot-password").then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import("../features/auth/reset-password").then((m) => ({ default: m.ResetPassword })));

// Each feature page is its own route-based chunk: the user only loads what they actually
// navigate to, instead of one big eager bundle with all 14 pages at once.
const Dashboard = lazy(() => import("../features/dashboard/dashboard").then((m) => ({ default: m.Dashboard })));
const Vacancies = lazy(() => import("../features/vacancies/vacancies").then((m) => ({ default: m.Vacancies })));
const Analyzer = lazy(() => import("../features/analyzer/analyzer").then((m) => ({ default: m.Analyzer })));
const Study = lazy(() => import("../features/study/study").then((m) => ({ default: m.Study })));
const CVView = lazy(() => import("../features/cv/cv").then((m) => ({ default: m.CVView })));
const CvBuilder = lazy(() => import("../features/cv/cv-builder").then((m) => ({ default: m.CvBuilder })));
const Companies = lazy(() => import("../features/companies/companies").then((m) => ({ default: m.Companies })));
const Jobs = lazy(() => import("../features/jobs/jobs").then((m) => ({ default: m.Jobs })));
const Resources = lazy(() => import("../features/resources/resources").then((m) => ({ default: m.Resources })));
const Projects = lazy(() => import("../features/projects/projects").then((m) => ({ default: m.Projects })));
const Roadmap = lazy(() => import("../features/roadmap/roadmap").then((m) => ({ default: m.Roadmap })));
const Analytics = lazy(() => import("../features/analytics/charts").then((m) => ({ default: m.Analytics })));
const Admin = lazy(() => import("../features/admin/admin").then((m) => ({ default: m.Admin })));
const Account = lazy(() => import("../features/account/account").then((m) => ({ default: m.Account })));
const Pricing = lazy(() => import("../features/billing/pricing").then((m) => ({ default: m.Pricing })));
const Welcome = lazy(() => import("../features/welcome/welcome").then((m) => ({ default: m.Welcome })));
const Calendar = lazy(() => import("../features/calendar/calendar").then((m) => ({ default: m.CalendarPage })));
const Contacts = lazy(() => import("../features/contacts/contacts").then((m) => ({ default: m.Contacts })));
const CoverLetter = lazy(() => import("../features/cv/cover-letter").then((m) => ({ default: m.CoverLetter })));
// Public (no session) — mounted at the same tier as /login below, NOT inside Shell/AuthGate.
const CvPublic = lazy(() => import("../features/cv/cv-public").then((m) => ({ default: m.CvPublic })));
const Privacy = lazy(() => import("../features/legal/privacy").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("../features/legal/terms").then((m) => ({ default: m.Terms })));

// Static structure — paths/icons never change with the language, only the label text does. Kept
// as translation KEYS (resolved to actual NavItem[] inside Shell() below, where useTranslation()
// is available) rather than translated up front: this is a module-level constant evaluated once
// at import time, before i18next necessarily even has a language chosen, and it wouldn't react to
// a language switch afterward if it held resolved strings.
//
// labelKey is typed against the ACTUAL nav.json shape (not a plain `string`) so a typo here is
// still a tsc error, same guarantee as calling t("...") with a literal — see i18n/i18next.d.ts's
// own comment on why that matters.
type NavItem = { path: string; icon: IconComponent; label: string };
type NavLabelKey = `items.${keyof (typeof import("../i18n/locales/en/nav.json"))["items"]}`;
type NavItemDef = {
  path: string;
  icon: IconComponent;
  labelKey: NavLabelKey;
  /** Sibling routes that belong to this same sidebar entry — the pages reachable through its
   * section tab strip (app/section-tabs.tsx). Without this, standing on /jobs would leave every
   * sidebar row unlit, because NavLink only ever matches its own `to`. */
  alsoMatches?: string[];
  /** Which "does the account have any data yet" flag dims this row on a brand-new account (see
   * Shell's `dimmed` below). The row stays clickable — the page's own EmptyState is a better
   * teacher than a missing menu item, and hiding entries outright means a user never learns the
   * feature exists. */
  needs?: "vacancies" | "network";
  /** Small pill on this row, hinting that it's a hub hiding several distinct screens rather than
   * one page — see NAV_DEF's Growth entry, the only row that currently sets this. Static (not
   * derived from PALETTE_DEF's length) so it names exactly what's inside rather than silently
   * drifting if an unrelated redirect gets added to `alsoMatches`. */
  groupCount?: number;
};

// EIGHT top-level destinations, flat and unsectioned. This used to be seventeen rows split
// across three labelled sections, which is roughly double the point where a menu stops being
// scanned and starts being read — and three of those rows ("Vacancies", "Job Search", "Vacancy
// Analysis") were near-identical labels sitting adjacent, with no way for a newcomer to guess
// which one they wanted. Related screens are now grouped behind ONE entry each and surfaced as a
// tab strip on the page itself (SectionTabs), so every original page keeps its own URL — old
// bookmarks, deep links and e2e specs all still resolve exactly where they did before.
const NAV_DEF: NavItemDef[] = [
  { path: "/dashboard", icon: HomeIcon, labelKey: "items.dashboard" },
  { path: "/vacancies", icon: BriefcaseIcon, labelKey: "items.vacancies", alsoMatches: ["/jobs", "/analyzer"] },
  { path: "/contacts", icon: UsersIcon, labelKey: "items.network", alsoMatches: ["/companies"], needs: "network" },
  { path: "/analytics", icon: BarChartIcon, labelKey: "items.analytics", needs: "vacancies" },
  { path: "/calendar", icon: CalendarIcon, labelKey: "items.calendar", needs: "vacancies" },
  {
    // Lands on the Roadmap — the group's natural starting point. There used to be a separate
    // /growth "overview" page here listing the other Growth screens as cards; once those screens
    // became tabs it was showing the same names, in the same order, directly under the tab strip
    // that already offered them (and had silently gone stale, listing four of six). A hub whose
    // whole job is a menu is dead weight next to a real menu, so it's gone — /growth redirects.
    path: "/roadmap",
    icon: MapIcon,
    labelKey: "items.growth",
    alsoMatches: ["/growth", "/plan21", "/learn", "/study", "/projects", "/resources"],
    // Nothing else in the collapsed 8-row sidebar hints that this one row actually opens seven
    // screens (skill roadmap, radar, learning materials, 21-day plan, practice — itself hosting
    // flashcards/drill/mock interview/design trainer as its own sub-modes —, pet projects,
    // resources): the section tab strip and the Study page's own mode switcher only appear once
    // you're already on this page, and ⌘K only helps someone who already knows a name to search
    // for. A small count makes that discoverable at a glance instead of by accident.
    groupCount: 7,
  },
  { path: "/cvbuilder", icon: FileTextIcon, labelKey: "items.cv", alsoMatches: ["/cv", "/cover-letter"] },
  { path: "/account", icon: SettingsIcon, labelKey: "items.account" },
];
const ADMIN_ITEM_DEF: NavItemDef = { path: "/admin", icon: ShieldIcon, labelKey: "items.admin" };

// Every individual screen, flat — what ⌘K searches over. Deliberately NOT derived from NAV_DEF:
// collapsing the sidebar to eight entries must not cost power users their one-keystroke jump
// straight to "Find jobs" or "Intensive plan", so the palette still indexes all of them by name.
const PALETTE_DEF: NavItemDef[] = [
  { path: "/dashboard", icon: HomeIcon, labelKey: "items.dashboard" },
  { path: "/vacancies", icon: BriefcaseIcon, labelKey: "items.vacancies" },
  { path: "/jobs", icon: SearchIcon, labelKey: "items.jobSearch" },
  { path: "/analyzer", icon: FileSearchIcon, labelKey: "items.vacancyAnalysis" },
  { path: "/contacts", icon: UsersIcon, labelKey: "items.contacts" },
  { path: "/companies", icon: BuildingIcon, labelKey: "items.companies" },
  { path: "/analytics", icon: BarChartIcon, labelKey: "items.analytics" },
  { path: "/calendar", icon: CalendarIcon, labelKey: "items.calendar" },
  { path: "/roadmap", icon: MapIcon, labelKey: "items.roadmap" },
  // These three resolve through RoadmapViewRedirect, which opens the matching view of /roadmap —
  // so ⌘K still reaches every screen by the name the user knows it by, even though they stopped
  // being routes of their own.
  { path: "/radar", icon: MapIcon, labelKey: "items.radar" },
  { path: "/plan21", icon: ListChecksIcon, labelKey: "items.intensivePlan" },
  { path: "/learn", icon: BookOpenIcon, labelKey: "items.learningPlan" },
  { path: "/study", icon: CardsStackIcon, labelKey: "items.practice" },
  { path: "/projects", icon: LayersIcon, labelKey: "items.petProjects" },
  { path: "/resources", icon: LibraryIcon, labelKey: "items.resources" },
  { path: "/cvbuilder", icon: WrenchIcon, labelKey: "items.cvBuilder" },
  { path: "/cv", icon: FileTextIcon, labelKey: "items.cvReview" },
  { path: "/cover-letter", icon: FileTextIcon, labelKey: "items.coverLetter" },
  { path: "/account", icon: SettingsIcon, labelKey: "items.account" },
];
const DEFAULT_PATH = "/dashboard";

function ToastHost() {
  const { toasts, dismissToast } = useToast();
  // success uses the vivid `star` fill + dark `on-signal` ink (a solid signal-brown fill would
  // read as dull/muddy at this size) — error/info keep their existing white-on-dark treatment.
  const tone: Record<string, string> = {
    success: "bg-star text-on-signal",
    error: "bg-rose-600 text-white",
    info: "bg-ink text-bg",
  };
  return (
    // z-[80] — above every modal/popover overlay in the app (popovers z-[75], confirm dialog
    // z-[70], the vacancy detail modal z-[65]): a toast is a glanceable, transient confirmation and
    // must never end up dimmed under another overlay's backdrop just because the two happened to
    // be triggered by the same action (e.g. adding a vacancy now both toasts AND opens its detail
    // modal at once — before this fix the modal's backdrop visibly washed the toast out).
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            t.onAction?.();
            dismissToast(t.id);
          }}
          className={`text-left text-sm px-4 py-2.5 rounded-xl shadow-lg ${tone[t.type]} animate-[jt-fade-in_0.2s_ease-out]`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}

function AiBadge() {
  const { t } = useTranslation("nav");
  const { data } = useHealth();
  const llm = data?.llm ?? false;
  return (
    <span
      className={`font-mono text-xs font-medium px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
        llm ? "border-signal/30 text-signal bg-signal/10" : "border-grid text-ink-dim bg-surface-2"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${llm ? "bg-star" : "bg-ink-dim"}`} />
      {llm ? t("ai.on") : t("ai.off")}
    </span>
  );
}

/** Shown only when billing is actually configured server-side AND the caller is on a finite
 * quota (Free) — a Pro/Team user has nothing to count down, and a self-hosted/unconfigured
 * deployment has no plan concept at all, so this renders nothing in either case. */
function AiQuotaBadge() {
  const { t } = useTranslation("billing");
  const { data } = useBilling();
  if (!data?.billingEnabled || data.aiCallsPerMonth === null) return null;
  const remaining = Math.max(0, data.aiCallsPerMonth - data.aiCallsUsed);
  return (
    <span className="font-mono text-xs font-medium px-2.5 py-1 rounded-full border border-grid text-ink-dim bg-surface-2 inline-flex items-center gap-1.5">
      {t("quota.badge", { count: remaining })}
    </span>
  );
}

// Was a plain <div> — read as a disconnected stat, not a link, since nothing about it looked
// clickable (no hover state, no chevron) even though it summarizes an actual page. `hover:` +
// an arrow glyph mark it as navigable the same way the sidebar's own nav items already do;
// "Roadmap" is the destination's own name (see sidebarItems), so this doubles as a label for it.
function SidebarProgress() {
  const { t } = useTranslation("nav");
  const { data: roadmap } = useRoadmap();
  const navigate = useNavigate();
  if (!roadmap) return null;
  return (
    <button
      type="button"
      onClick={() => navigate("/roadmap")}
      className="w-full text-left rounded-xl bg-surface border border-grid p-2.5 hover:border-signal/40 hover:bg-surface-2 transition-colors"
    >
      <div className="flex items-center gap-1 text-xs font-medium text-ink-dim mb-1">
        <span>{t("roadmapProgress", { done: roadmap.progress.done, total: roadmap.progress.total })}</span>
        <span className="ml-auto text-signal" aria-hidden="true">
          →
        </span>
      </div>
      <ProgressBar value={roadmap.progress.done} max={roadmap.progress.total} tone="emerald" />
    </button>
  );
}

/* ---------- Section layouts ----------
 * Pathless layout routes (a <Route> with an `element` and no `path`) that wrap a group of
 * sibling pages with SectionTabs' tab strip. Because they contribute nothing to the URL, every
 * child keeps the exact path it always had. Each child also keeps rendering its own PageHeader
 * below the strip — including whatever controls it hangs off that header's `actions` slot (the
 * vacancy table/board switch, Companies' add-company input, Practice's mode buttons), which a
 * "hoist one shared header into the layout" approach would have quietly dropped. */
function VacanciesLayout() {
  const { t } = useTranslation("sections");
  return (
    <SectionTabs
      ariaLabel={t("vacancies.ariaLabel")}
      tabs={[
        { path: "/vacancies", label: t("vacancies.tabs.tracker") },
        { path: "/jobs", label: t("vacancies.tabs.find") },
        { path: "/analyzer", label: t("vacancies.tabs.analyze") },
      ]}
    />
  );
}
function NetworkLayout() {
  const { t } = useTranslation("sections");
  return (
    <SectionTabs
      ariaLabel={t("network.ariaLabel")}
      tabs={[
        { path: "/contacts", label: t("network.tabs.contacts") },
        { path: "/companies", label: t("network.tabs.companies") },
      ]}
    />
  );
}
function GrowthLayout() {
  const { t } = useTranslation("sections");
  return (
    <SectionTabs
      ariaLabel={t("growth.ariaLabel")}
      tabs={[
        { path: "/roadmap", label: t("growth.tabs.roadmap") },
        { path: "/study", label: t("growth.tabs.study") },
        { path: "/projects", label: t("growth.tabs.projects") },
        { path: "/resources", label: t("growth.tabs.resources") },
      ]}
    />
  );
}
function CvLayout() {
  const { t } = useTranslation("sections");
  return (
    <SectionTabs
      ariaLabel={t("cv.ariaLabel")}
      tabs={[
        { path: "/cvbuilder", label: t("cv.tabs.builder") },
        { path: "/cv", label: t("cv.tabs.review") },
        { path: "/cover-letter", label: t("cv.tabs.coverLetter") },
      ]}
    />
  );
}

/** Redirects to the Roadmap AND opens one of its views. The Radar / Materials / Intensive screens
 * used to be routes of their own; they're now views of `/roadmap` (see roadmap.tsx for why). A
 * plain `<Navigate>` would honour the old bookmark but dump the visitor on the default skill list
 * — technically "not a 404", practically the wrong page. This sets the same `"roadmap.view"`
 * useUi key roadmap.tsx reads before handing over, so /plan21 still lands on the Intensive plan,
 * and ⌘K's entries for those screens keep meaning what they say. */
function RoadmapViewRedirect({ view }: { view: RoadmapView }) {
  const [, setView] = useUi<RoadmapView>("roadmap.view", "list");
  useEffect(() => {
    setView(view);
    // Also persisted, so a reload on the redirected-to /roadmap stays on this view instead of
    // snapping back to the skill list (see roadmap.tsx for why the view is stored at all).
    storeRoadmapView(view);
  }, [setView, view]);
  return <Navigate to="/roadmap" replace />;
}

/** Whether `item` is the sidebar entry for the page currently on screen — its own path, or any
 * of the sibling routes reachable through its section tab strip. Compared against full path
 * segments (not `startsWith`, which would light up "/cv" while standing on "/cvbuilder"). */
function navItemActive(item: { path: string; alsoMatches?: string[] }, pathname: string): boolean {
  return [item.path, ...(item.alsoMatches ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** One sidebar row. `active` is passed in rather than taken from NavLink's own `isActive`,
 * because a row now stands for a whole section: /jobs and /analyzer both have to light up
 * "Vacancies" (see navItemActive). `dimHint` marks a section the account has no data for yet —
 * rendered at reduced opacity with the hint as its tooltip, but still a live link. */
function navBtn(item: NavItem & { active: boolean; dimHint?: string; groupCount?: number; groupHint?: string }) {
  // No font-display here — the landing page's own nav uses its body font, not the display face;
  // reserve font-display for headings/wordmark. Active state fills with the vivid, theme-
  // independent `star` (never `signal` — see shared/ui.tsx's Btn-primary comment: `signal` is
  // deepened/lightened per-theme for AA-contrast TEXT, not tuned as a large filled area). This
  // used to be `bg-signal`, which happened to look fine in light mode (there `--signal` is a deep
  // indigo, incidentally close to `--star`) but broke badly in dark mode, where `--signal` flips
  // to a PALE indigo-300 (tuned to read as text on a dark surface) — filling the whole active nav
  // row with that pale value made it look like a glaring, washed-out block against the dark
  // sidebar instead of a confident brand-colored highlight.
  const Icon = item.icon;
  return (
    <NavLink
      key={item.path}
      to={item.path}
      title={item.dimHint ?? item.groupHint}
      aria-current={item.active ? "page" : undefined}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        item.active ? "bg-star text-on-signal" : "text-ink-dim hover:bg-surface-2"
      } ${item.dimHint && !item.active ? "opacity-45 hover:opacity-100" : ""}`}
    >
      <span className="w-5 flex justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      {item.label}
      {/* Hints that this one row is a hub for several screens (see NAV_DEF's groupCount comment)
          — the same pill shape/scale as AiBadge's dot, just with a count instead of a status dot,
          so it reads as "more inside" rather than another status indicator. Decorative: the same
          information is in the row's own `title` tooltip (groupHint) for anyone who stops on it. */}
      {item.groupCount != null && (
        <span
          aria-hidden="true"
          className={`ml-auto shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            item.active ? "bg-on-signal/20 text-on-signal" : "border border-grid text-ink-dim bg-surface-2"
          }`}
        >
          {item.groupCount}
        </span>
      )}
    </NavLink>
  );
}

/** better-auth's `useSession` flips `isPending` back to `true` on every REFETCH, not just the
 * first load — and it refetches after `signUp.email()`, `signOut()`, and any other call that
 * could have changed the session. A gate that renders nothing while `isPending` therefore
 * UNMOUNTS whatever is on screen mid-flight and remounts it with all of its state gone. That's
 * what made a successful registration look like nothing happened at all: sign-up succeeded (the
 * account was created, the verification email sent), the refetch it triggers blanked /register,
 * and `Register` came back freshly mounted — no "check your email" screen, and the typed-in
 * fields wiped. So the gates below block only on the FIRST, genuinely-unresolved load; once a
 * session state is known, a background refetch keeps rendering the current one. */
function useResolvedSession() {
  const { data: session, isPending } = useSession();
  const resolvedOnce = useRef(false);
  if (!isPending) resolvedOnce.current = true;
  return { session, loading: isPending && !resolvedOnce.current };
}

/** Wraps /login, /register, /forgot-password, /reset-password — bounces an already-signed-in user to the app instead of showing them a login form. */
function PublicRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useResolvedSession();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Sends a stranger who hasn't seen /welcome there at least once — mounted in Shell rather than
 * gating AuthGate's render on this fetch, so every route doesn't wait on an extra round-trip
 * before showing anything (the same "watch, don't block" pattern as FetchAllJobNotifier and the
 * other Shell-mounted notifiers). A one-render flash of the destination page before the redirect
 * fires is an acceptable trade for that. Renders nothing itself. */
function WelcomeRedirect() {
  const { data } = useOnboardingState();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (data?.welcomeSeen === false && location.pathname !== "/welcome") {
      navigate("/welcome", { replace: true });
    }
  }, [data?.welcomeSeen, location.pathname, navigate]);
  return null;
}

/** Fires the pending referral claim (if any — see shared/referral-storage.ts) exactly once per
 * mount, on a real authenticated session. Mounted in Shell rather than gated behind onboarding
 * so it also fires for an existing user who happens to have a stale code sitting in storage from
 * before they last signed in — claimReferral() on the server is a cheap no-op for them either
 * way (already-has-a-referral-row, or self-referral). Renders nothing. */
function ReferralClaimer() {
  const claim = useClaimReferral();
  useEffect(() => {
    const code = takeStoredReferralCode();
    if (code) claim.mutate(code);
    // Intentionally runs once per mount, not on every `claim` identity change (mutate is stable
    // enough in practice, but re-running this on re-render would re-read storage that
    // takeStoredReferralCode() already cleared on the first call anyway).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Wraps /welcome — needs a real session (so a signed-out visitor can't reach it) but deliberately
 * NOT nested inside AuthGate/Shell: it's a focused, chrome-free moment, not a page in the main app. */
function WelcomeGate() {
  const { session, loading } = useResolvedSession();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <Welcome />;
}

/** Everything under "/" — redirects a signed-out visitor to /login instead of rendering the app shell. */
function AuthGate() {
  const { session, loading } = useResolvedSession();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CardsSkeleton count={1} />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Shell />;
}

/** Wraps /admin — a non-admin who navigates or types the URL directly is bounced to the
 * dashboard instead of seeing a 403 page; the nav item itself is already hidden for them (see
 * Shell), this is the second layer for direct navigation/bookmarks. */
function AdminGate({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  if (session?.user?.role !== "admin") return <Navigate to={DEFAULT_PATH} replace />;
  return <>{children}</>;
}

function Shell() {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isError: connectionError } = useHealth();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const queryClient = useQueryClient();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Desktop-only — mobile already has its own compact top nav, not this sidebar. Persisted so a
  // preference (e.g. "give the Kanban board more room") survives a reload.
  const [sidebarCollapsed, setSidebarCollapsed] = useUi<boolean>("shell.sidebarCollapsed", false);
  const go = (path: string) => navigate(`/${path}`);
  // "Does this account have anything here yet", for the dimming below. Both flags come from
  // /onboarding/state — which this shell ALREADY fetches on every route (see WelcomeRedirect), so
  // this costs no extra request. Deriving them from useVacancies()/useContacts() here instead
  // would have put three list queries on every page in the app (the "god context" CLAUDE.md warns
  // off), and reading those queries' CACHE instead made the dimming inconsistent — the same
  // account looked empty on Practice and populated on Vacancies, purely by which page happened to
  // have fetched what. `undefined` (still loading) counts as "has data": a nav that flickers
  // half-dim on every cold load would be worse than never dimming at all.
  const { data: onboarding } = useOnboardingState();
  const hasVacancies = onboarding === undefined || onboarding.hasVacancies;
  const hasNetwork = onboarding === undefined || onboarding.hasNetwork;
  const dimHintFor = (needs: NavItemDef["needs"]): string | undefined => {
    if (needs === "vacancies" && !hasVacancies) return t("locked.needsVacancy");
    if (needs === "network" && !hasNetwork) return t("locked.needsNetwork");
    return undefined;
  };
  // Resolved from NAV_DEF/PALETTE_DEF/ADMIN_ITEM_DEF's translation keys here (not at module
  // load) — see those constants' own comment for why.
  const resolve = (it: NavItemDef) => ({
    ...it,
    label: t(it.labelKey),
    active: navItemActive(it, location.pathname),
    dimHint: dimHintFor(it.needs),
    groupHint: it.groupCount ? t("growthHint") : undefined,
  });
  const adminItem = resolve(ADMIN_ITEM_DEF);
  const sidebarItems = isAdmin ? [...NAV_DEF.map(resolve), adminItem] : NAV_DEF.map(resolve);
  // ⌘K indexes every individual screen, not just the eight sidebar sections (see PALETTE_DEF).
  const paletteItems: NavItem[] = [...PALETTE_DEF, ...(isAdmin ? [ADMIN_ITEM_DEF] : [])].map((it) => ({
    ...it,
    label: t(it.labelKey),
  }));
  // Mobile: the four destinations worth a permanent thumb-reachable slot, everything else behind
  // "More". Split by path so the choice is explicit rather than "whatever the first four are".
  const MOBILE_PRIMARY_PATHS = ["/dashboard", "/vacancies", "/roadmap", "/cvbuilder"];
  const mobilePrimary = sidebarItems.filter((it) => MOBILE_PRIMARY_PATHS.includes(it.path));
  const mobileMore = sidebarItems.filter((it) => !MOBILE_PRIMARY_PATHS.includes(it.path));

  async function logOut() {
    await signOut();
    // Clears every cached query (vacancies, profile, etc.) — otherwise the next person to sign
    // in on this device/browser would briefly see the previous account's cached data.
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  // Each page now owns its own loading/empty state via its own query hooks (instead of one
  // global "wait for everything"), so all that's left here is a notification for a complete
  // loss of connection to the server.
  useEffect(() => {
    if (connectionError) toast(t("connectionError"), "error");
  }, [connectionError, toast, t]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar — collapsible (persisted) so pages that want the extra width, e.g. the
          Vacancies Kanban board with its many status columns, can get it without losing the nav
          entirely: a small floating button brings it right back. */}
      {!sidebarCollapsed && (
        <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-grid bg-surface/70 backdrop-blur-md p-3.5 gap-2.5 overflow-y-auto">
          <div className="flex items-center justify-between">
            <Wordmark size="sm" />
            {/* Same square, bordered shape as the floating "show sidebar" button below (not just a
                bare glyph) — a real button, not a stray character sitting in the corner. */}
            <button
              onClick={() => setSidebarCollapsed(true)}
              aria-label={t("hideSidebar")}
              title={t("hideSidebar")}
              className="flex items-center justify-center w-7 h-7 rounded-lg border border-grid text-ink-dim hover:text-ink hover:border-signal/40 hover:bg-surface-2 transition-colors"
            >
              <ChevronsLeftIcon className="w-4 h-4" />
            </button>
          </div>
          <AiBadge />
          <AiQuotaBadge />
          <div className="flex items-center justify-between gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-grid bg-surface text-xs text-ink-dim hover:border-signal/40 hover:text-ink transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <SearchIcon className="w-3.5 h-3.5" />
              {t("search")}
            </span>
            <span className="ml-auto font-mono text-[10px] bg-surface-2 rounded px-1.5 py-0.5 text-ink-dim">⌘K</span>
          </button>
          {/* Flat and unlabelled — at eight entries, section headers cost a line of chrome each
              and buy nothing; they were only ever load-bearing back when this list was 17 rows. */}
          <nav className="flex flex-col gap-0.5 flex-1">{sidebarItems.map((it) => navBtn(it))}</nav>
          <SidebarProgress />
          <Btn variant="ghost" size="sm" onClick={logOut}>
            {t("logOut")}
          </Btn>
          <div className="flex items-center justify-center gap-3 text-[11px] text-ink-dim">
            <NavLink to="/privacy" className="hover:text-ink hover:underline">
              {t("footer.privacy")}
            </NavLink>
            <span aria-hidden="true">·</span>
            <NavLink to="/terms" className="hover:text-ink hover:underline">
              {t("footer.terms")}
            </NavLink>
          </div>
        </aside>
      )}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          aria-label={t("showSidebar")}
          title={t("showSidebar")}
          className="hidden lg:flex fixed top-3 left-3 z-30 items-center justify-center w-8 h-8 rounded-lg border border-grid bg-surface/90 backdrop-blur-md text-ink-dim hover:text-ink hover:border-signal/40 shadow-sm transition-colors"
        >
          <ChevronsLeftIcon className="w-4 h-4 rotate-180" />
        </button>
      )}

      {/* Mobile top bar — identity and global switches only. The navigation itself moved to the
          bottom bar (app/mobile-nav.tsx), where a thumb can actually reach it. */}
      {/* The "show sidebar" button above is `fixed`, so it's out of flow and would sit ON TOP of
          whatever the page renders in its top-left corner (a SectionTabs tab, a PageHeader title).
          Reserving a narrow rail's worth of left padding while collapsed keeps it clear of the
          content — the freed width is still reclaimed by <main>'s wider max-w below. */}
      <div className={`flex-1 min-w-0 ${sidebarCollapsed ? "lg:pl-14" : ""}`}>
        <header className="lg:hidden sticky top-0 z-20 bg-surface/80 backdrop-blur-md border-b border-grid">
          <div className="px-4 py-3 flex items-center gap-3">
            <Wordmark size="sm" />
            <div className="ml-auto flex items-center gap-2">
              <AiBadge />
              <AiQuotaBadge />
              <Btn variant="ghost" size="sm" onClick={() => setPaletteOpen(true)} aria-label={t("openCommandPalette")}>
                <SearchIcon className="w-4 h-4" />
              </Btn>
            </div>
          </div>
        </header>

        {/* max-w widens when the sidebar is collapsed — otherwise the freed ~256px just becomes
            idle margin on a wide viewport instead of being reclaimed by the content (the whole
            point of the collapse toggle, e.g. for the Vacancies Kanban board).
            pb-24 on mobile keeps the last card clear of the fixed bottom nav. */}
        <main className={`mx-auto px-4 py-6 pb-24 lg:pb-6 ${sidebarCollapsed ? "max-w-[96rem]" : "max-w-7xl"}`}>
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<CardsSkeleton count={2} />}>
              <Routes>
                <Route path="/" element={<Navigate to={DEFAULT_PATH} replace />} />
                <Route path="/dashboard" element={<Dashboard go={go} />} />
                {/* Four pathless layout routes (no `path` of their own) add each section's tab
                    strip WITHOUT touching any child's URL — see app/section-tabs.tsx. */}
                <Route element={<VacanciesLayout />}>
                  <Route path="/vacancies" element={<Vacancies />} />
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="/analyzer" element={<Analyzer />} />
                </Route>
                <Route element={<NetworkLayout />}>
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/companies" element={<Companies />} />
                </Route>
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route element={<GrowthLayout />}>
                  <Route path="/roadmap" element={<Roadmap />} />
                  <Route path="/study" element={<Study />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/resources" element={<Resources />} />
                </Route>
                {/* Mock Interview and Skill Radar are tabs inside Practice/Roadmap respectively
                    — old links/bookmarks still resolve. */}
                <Route path="/mock" element={<Navigate to="/study" replace />} />
                {/* The Growth overview page is gone (see NAV_DEF) — its bookmarks land on the
                    group's first tab instead of 404ing. */}
                <Route path="/growth" element={<Navigate to="/roadmap" replace />} />
                <Route path="/radar" element={<RoadmapViewRedirect view="radar" />} />
                {/* "Learning plan" was a separate page whose name read as a synonym of "Roadmap";
                    it's now that page's "Materials" view, built from the same gap data. */}
                <Route path="/learn" element={<RoadmapViewRedirect view="materials" />} />
                {/* Same story as /learn: "Intensive plan" was a third destination whose name read
                    as a synonym of the other two. It's now the Roadmap's "Intensive" view. */}
                <Route path="/plan21" element={<RoadmapViewRedirect view="plan" />} />
                <Route element={<CvLayout />}>
                  <Route path="/cvbuilder" element={<CvBuilderWrapper />} />
                  <Route path="/cv" element={<CVWrapper />} />
                  <Route path="/cover-letter" element={<CoverLetter />} />
                </Route>
                {/* The sidebar link is "/cvbuilder" (no hyphen), but "/cv-builder" is the more
                    guessable/typed spelling — redirect it instead of 404ing on a reasonable guess. */}
                <Route path="/cv-builder" element={<Navigate to="/cvbuilder" replace />} />
                <Route path="/account" element={<Account />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route
                  path="/admin"
                  element={
                    <AdminGate>
                      <Admin />
                    </AdminGate>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <ToastHost />
      <CelebrationOverlay />
      <FetchAllJobNotifier />
      <CvAuditJobNotifier />
      <AiQuotaNotifier />
      <WelcomeRedirect />
      <ReferralClaimer />
      <CalendarReminderNotifier />
      <MobileNav primary={mobilePrimary} more={mobileMore} onLogOut={logOut} />
      <CommandPalette
        items={paletteItems}
        actions={[{ id: "logout", icon: LogOutIcon, label: t("logOut"), onRun: logOut }]}
        open={paletteOpen}
        setOpen={setPaletteOpen}
      />
    </div>
  );
}

function CVWrapper() {
  const { data } = useHealth();
  return <CVView llm={data?.llm ?? false} />;
}
function CvBuilderWrapper() {
  const { data } = useHealth();
  return <CvBuilder llm={data?.llm ?? false} />;
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 min — aggregator/external search data doesn't change every minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmDialogProvider>
          <BrowserRouter>
            <Suspense fallback={null}>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicRoute>
                      <Register />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <PublicRoute>
                      <ForgotPassword />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/reset-password"
                  element={
                    <PublicRoute>
                      <ResetPassword />
                    </PublicRoute>
                  }
                />
                {/* Needs a session but no Shell chrome — see WelcomeGate's own comment. */}
                <Route path="/welcome" element={<WelcomeGate />} />
                {/* Public — no session, no Shell chrome (see cv-public.tsx). Deliberately NOT
                  wrapped in PublicRoute: an already-signed-in visitor should still be able to
                  open a (their own, or anyone else's) shared CV link while logged in. */}
                <Route path="/cv/public/:slug" element={<CvPublic />} />
                {/* Public legal pages — reachable signed-in or signed-out (e.g. from the register
                    page's footer, before an account exists), so also not wrapped in PublicRoute. */}
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/*" element={<AuthGate />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ConfirmDialogProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
