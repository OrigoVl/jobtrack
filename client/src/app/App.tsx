import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
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
import { CvReviewJobNotifier } from "../shared/cv-review-notifier";
import { AiQuotaNotifier } from "../shared/ai-quota-notifier";
import { CalendarReminderNotifier } from "../features/calendar/calendar-reminder-notifier";
import { LanguageSwitcher } from "../shared/language-switcher";
import { ThemeSwitcher } from "../shared/theme-switcher";
import { ErrorBoundary } from "../shared/error-boundary";
import { useSession, signOut } from "../shared/auth-client";
import { takeStoredReferralCode } from "../shared/referral-storage";
import { CommandPalette } from "./command-palette";
import { NotFound } from "./not-found";
import {
  BarChartIcon,
  BookOpenIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CardsStackIcon,
  ChevronsLeftIcon,
  FileSearchIcon,
  FileTextIcon,
  HomeIcon,
  LayersIcon,
  LibraryIcon,
  ListChecksIcon,
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
const LearnPlan = lazy(() => import("../features/knowledge/learn").then((m) => ({ default: m.LearnPlan })));
const Resources = lazy(() => import("../features/resources/resources").then((m) => ({ default: m.Resources })));
const Projects = lazy(() => import("../features/projects/projects").then((m) => ({ default: m.Projects })));
const Plan21 = lazy(() => import("../features/plan21/plan21").then((m) => ({ default: m.Plan21 })));
const Roadmap = lazy(() => import("../features/roadmap/roadmap").then((m) => ({ default: m.Roadmap })));
const GrowthHub = lazy(() => import("../features/growth/growth-hub").then((m) => ({ default: m.GrowthHub })));
const Analytics = lazy(() => import("../features/analytics/charts").then((m) => ({ default: m.Analytics })));
const Admin = lazy(() => import("../features/admin/admin").then((m) => ({ default: m.Admin })));
const Account = lazy(() => import("../features/account/account").then((m) => ({ default: m.Account })));
const Pricing = lazy(() => import("../features/billing/pricing").then((m) => ({ default: m.Pricing })));
const Welcome = lazy(() => import("../features/welcome/welcome").then((m) => ({ default: m.Welcome })));
const Calendar = lazy(() => import("../features/calendar/calendar").then((m) => ({ default: m.CalendarPage })));
const Contacts = lazy(() => import("../features/contacts/contacts").then((m) => ({ default: m.Contacts })));
// Public (no session) — mounted at the same tier as /login below, NOT inside Shell/AuthGate.
const CvPublic = lazy(() => import("../features/cv/cv-public").then((m) => ({ default: m.CvPublic })));
const Privacy = lazy(() => import("../features/legal/privacy").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("../features/legal/terms").then((m) => ({ default: m.Terms })));

// Static structure — paths/icons/grouping never change with the language, only the label text
// does. Kept as translation KEYS (resolved to actual NavItem[] inside Shell() below, where
// useTranslation() is available) rather than translated up front: this is a module-level
// constant evaluated once at import time, before i18next necessarily even has a language chosen,
// and it wouldn't react to a language switch afterward if it held resolved strings.
//
// labelKey/sectionKey are typed against the ACTUAL nav.json shape (not a plain `string`) so a
// typo here is still a tsc error, same guarantee as calling t("...") with a literal — see
// i18n/i18next.d.ts's own comment on why that matters for the Phase B delegation.
type NavItem = { path: string; icon: IconComponent; label: string };
type NavLabelKey = `items.${keyof (typeof import("../i18n/locales/en/nav.json"))["items"]}`;
type NavSectionKey = `sections.${keyof (typeof import("../i18n/locales/en/nav.json"))["sections"]}`;
type NavItemDef = { path: string; icon: IconComponent; labelKey: NavLabelKey; sidebarHidden?: boolean };
const NAV_DEF: { sectionKey: NavSectionKey; items: NavItemDef[] }[] = [
  {
    sectionKey: "sections.jobSearch",
    items: [
      { path: "/dashboard", icon: HomeIcon, labelKey: "items.dashboard" },
      { path: "/vacancies", icon: BriefcaseIcon, labelKey: "items.vacancies" },
      { path: "/jobs", icon: SearchIcon, labelKey: "items.jobSearch" },
      { path: "/analyzer", icon: FileSearchIcon, labelKey: "items.vacancyAnalysis" },
      { path: "/companies", icon: BuildingIcon, labelKey: "items.companies" },
      { path: "/contacts", icon: UsersIcon, labelKey: "items.contacts" },
      { path: "/analytics", icon: BarChartIcon, labelKey: "items.analytics" },
      { path: "/calendar", icon: CalendarIcon, labelKey: "items.calendar" },
    ],
  },
  {
    sectionKey: "sections.growth",
    items: [
      // Roadmap includes the former "Skill Radar" page as a tab, and Practice includes the
      // former "Mock Interview" page as a mode — related screens grouped instead of scattered
      // across the sidebar (old /radar and /mock links still work, see the redirects below).
      // These four are independent pages (market-wide skill map, a day plan, deep-dive material,
      // flashcards/drills), not a sequence — each gets its own flat, equally-weighted sidebar row
      // so its own item lights up via NavLink's normal exact-path match when you're on it (no
      // grouping/nesting: that read as a confusing sub-menu in practice). /growth is a separate
      // overview page linking to all four with a live progress readout from each (growth-hub.tsx)
      // — `sidebarHidden` keeps it out of this list (redundant with the four rows right above it)
      // while it stays reachable via ⌘K.
      { path: "/roadmap", icon: MapIcon, labelKey: "items.roadmap" },
      { path: "/plan21", icon: ListChecksIcon, labelKey: "items.intensivePlan" },
      { path: "/learn", icon: BookOpenIcon, labelKey: "items.learningPlan" },
      { path: "/study", icon: CardsStackIcon, labelKey: "items.practice" },
      { path: "/growth", icon: MapIcon, labelKey: "items.growthHub", sidebarHidden: true },
      { path: "/projects", icon: LayersIcon, labelKey: "items.petProjects" },
      { path: "/resources", icon: LibraryIcon, labelKey: "items.resources" },
    ],
  },
  {
    sectionKey: "sections.profile",
    items: [
      { path: "/cv", icon: FileTextIcon, labelKey: "items.cv" },
      { path: "/cvbuilder", icon: WrenchIcon, labelKey: "items.cvBuilder" },
      { path: "/account", icon: SettingsIcon, labelKey: "items.account" },
    ],
  },
];
const ADMIN_ITEM_DEF: NavItemDef = { path: "/admin", icon: ShieldIcon, labelKey: "items.admin" };
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
          onClick={() => dismissToast(t.id)}
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

function SidebarProgress() {
  const { t } = useTranslation("nav");
  const { data: roadmap } = useRoadmap();
  if (!roadmap) return null;
  return (
    <div className="rounded-xl bg-surface border border-grid p-2.5">
      <div className="text-xs font-medium text-ink-dim mb-1">
        {t("roadmapProgress", { done: roadmap.progress.done, total: roadmap.progress.total })}
      </div>
      <ProgressBar value={roadmap.progress.done} max={roadmap.progress.total} tone="emerald" />
    </div>
  );
}

function navBtn(item: NavItem, compact = false) {
  // No font-display here — the landing page's own nav uses its body font, not the display face;
  // reserve font-display for headings/wordmark. Active state fills with the vivid, theme-
  // independent `star` (never `signal` — see shared/ui.tsx's Btn-primary comment: `signal` is
  // deepened/lightened per-theme for AA-contrast TEXT, not tuned as a large filled area). This
  // used to be `bg-signal`, which happened to look fine in light mode (there `--signal` is a deep
  // indigo, incidentally close to `--star`) but broke badly in dark mode, where `--signal` flips
  // to a PALE indigo-300 (tuned to read as text on a dark surface) — filling the whole active nav
  // row with that pale value made it look like a glaring, washed-out block against the dark
  // sidebar instead of a confident brand-colored highlight.
  const cls = ({ isActive }: { isActive: boolean }) =>
    compact
      ? `shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? "bg-star text-on-signal" : "text-ink-dim hover:bg-surface-2"
        }`
      : `w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? "bg-star text-on-signal" : "text-ink-dim hover:bg-surface-2"
        }`;
  const Icon = item.icon;
  return (
    <NavLink key={item.path} to={item.path} className={cls}>
      <span className={compact ? "mr-1 flex" : "w-5 flex justify-center shrink-0"}>
        <Icon className="w-4 h-4" />
      </span>
      {item.label}
    </NavLink>
  );
}

/** Wraps /login, /register, /forgot-password, /reset-password — bounces an already-signed-in user to the app instead of showing them a login form. */
function PublicRoute({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  if (isPending) return null;
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
  const { data: session, isPending } = useSession();
  if (isPending) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <Welcome />;
}

/** Everything under "/" — redirects a signed-out visitor to /login instead of rendering the app shell. */
function AuthGate() {
  const { data: session, isPending } = useSession();
  const location = useLocation();
  if (isPending) {
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
  // Resolved from NAV_DEF/ADMIN_ITEM_DEF's translation keys here (not at module load) — see
  // those constants' own comment for why.
  const navAll = NAV_DEF.map((group) => ({
    section: t(group.sectionKey),
    items: group.items.map((it) => ({ ...it, label: t(it.labelKey) })),
  }));
  // The desktop sidebar list only shows non-hidden items (see NAV_DEF's growth section comment);
  // the command palette and mobile nav below use `allItems`/`navAll` unfiltered so a hidden page
  // (e.g. /growth) is still one ⌘K search away.
  const nav = navAll.map((group) => ({ ...group, items: group.items.filter((it) => !it.sidebarHidden) }));
  const adminItem: NavItem = { ...ADMIN_ITEM_DEF, label: t(ADMIN_ITEM_DEF.labelKey) };
  const allItems = isAdmin ? [...navAll.flatMap((g) => g.items), adminItem] : navAll.flatMap((g) => g.items);

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
          <nav className="flex flex-col gap-2.5 flex-1">
            {nav.map((group) => (
              <div key={group.section}>
                <div className="eyebrow text-ink-dim px-3 mb-1">{group.section}</div>
                <div className="flex flex-col gap-0.5">{group.items.map((it) => navBtn(it))}</div>
              </div>
            ))}
            {isAdmin && (
              <div>
                <div className="eyebrow text-ink-dim px-3 mb-1">{t("sections.admin")}</div>
                <div className="flex flex-col gap-0.5">{navBtn(adminItem)}</div>
              </div>
            )}
          </nav>
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

      {/* Mobile top nav */}
      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-surface/80 backdrop-blur-md border-b border-grid">
          <div className="px-4 py-3 flex items-center gap-3">
            <Wordmark size="sm" />
            <div className="ml-auto flex items-center gap-2">
              <AiBadge />
              <AiQuotaBadge />
              <Btn variant="ghost" size="sm" onClick={() => setPaletteOpen(true)} aria-label={t("openCommandPalette")}>
                <SearchIcon className="w-4 h-4" />
              </Btn>
              <Btn variant="ghost" size="sm" onClick={logOut}>
                {t("logOut")}
              </Btn>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 no-scrollbar">{allItems.map((it) => navBtn(it, true))}</nav>
        </header>

        {/* max-w widens when the sidebar is collapsed — otherwise the freed ~256px just becomes
            idle margin on a wide viewport instead of being reclaimed by the content (the whole
            point of the collapse toggle, e.g. for the Vacancies Kanban board). */}
        <main className={`mx-auto px-4 py-6 ${sidebarCollapsed ? "max-w-[96rem]" : "max-w-7xl"}`}>
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<CardsSkeleton count={2} />}>
              <Routes>
                <Route path="/" element={<Navigate to={DEFAULT_PATH} replace />} />
                <Route path="/dashboard" element={<Dashboard go={go} />} />
                <Route path="/vacancies" element={<Vacancies />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/analyzer" element={<Analyzer />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/growth" element={<GrowthHub />} />
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/plan21" element={<Plan21 />} />
                <Route path="/learn" element={<LearnPlanWrapper />} />
                <Route path="/study" element={<Study />} />
                {/* Mock Interview and Skill Radar are now tabs inside Practice/Roadmap
                    respectively (see NAV_DEF above) — old links/bookmarks still resolve. */}
                <Route path="/mock" element={<Navigate to="/study" replace />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/radar" element={<Navigate to="/roadmap" replace />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/cv" element={<CVWrapper />} />
                <Route path="/cvbuilder" element={<CvBuilderWrapper />} />
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
      <CvReviewJobNotifier />
      <AiQuotaNotifier />
      <WelcomeRedirect />
      <ReferralClaimer />
      <CalendarReminderNotifier />
      <CommandPalette
        items={allItems}
        actions={[{ id: "logout", icon: LogOutIcon, label: t("logOut"), onRun: logOut }]}
        open={paletteOpen}
        setOpen={setPaletteOpen}
      />
    </div>
  );
}

function LearnPlanWrapper() {
  const { data } = useHealth();
  return <LearnPlan llm={data?.llm ?? false} />;
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
