import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ToastProvider } from "../shared/toast";
import { useToast } from "../shared/use-toast";
import { useHealth, useRoadmap } from "../shared/queries";
import { CardsSkeleton, ProgressBar, Btn } from "../shared/ui";
import { ErrorBoundary } from "../shared/error-boundary";
import { useSession, signOut } from "../shared/auth-client";
import { CommandPalette } from "./command-palette";

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
const Analytics = lazy(() => import("../features/analytics/charts").then((m) => ({ default: m.Analytics })));
const Admin = lazy(() => import("../features/admin/admin").then((m) => ({ default: m.Admin })));

type NavItem = { path: string; icon: string; label: string };
const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Job Search",
    items: [
      { path: "/dashboard", icon: "🏠", label: "Dashboard" },
      { path: "/vacancies", icon: "📋", label: "Vacancies" },
      { path: "/jobs", icon: "🔎", label: "Job Search" },
      { path: "/analyzer", icon: "🔍", label: "Vacancy Analysis" },
      { path: "/companies", icon: "🏢", label: "Companies" },
      { path: "/analytics", icon: "📊", label: "Analytics" },
    ],
  },
  {
    section: "Growth",
    items: [
      // Roadmap includes the former "Skill Radar" page as a tab, and Practice includes the
      // former "Mock Interview" page as a mode — related screens grouped instead of scattered
      // across the sidebar (old /radar and /mock links still work, see the redirects below).
      { path: "/roadmap", icon: "🗺️", label: "Roadmap" },
      { path: "/plan21", icon: "📅", label: "Intensive plan" },
      { path: "/learn", icon: "📚", label: "Learning Plan" },
      { path: "/study", icon: "🧠", label: "Practice" },
      { path: "/projects", icon: "🧩", label: "Pet Projects" },
      { path: "/resources", icon: "📖", label: "Resources" },
    ],
  },
  {
    section: "Profile",
    items: [
      { path: "/cv", icon: "📄", label: "CV" },
      { path: "/cvbuilder", icon: "🛠", label: "CV Builder" },
    ],
  },
];
const ALL_ITEMS = NAV.flatMap((g) => g.items);
const ADMIN_ITEM: NavItem = { path: "/admin", icon: "🛡️", label: "Admin" };
const DEFAULT_PATH = "/dashboard";

function ToastHost() {
  const { toasts, dismissToast } = useToast();
  const tone: Record<string, string> = {
    success: "bg-emerald-600",
    error: "bg-rose-600",
    info: "bg-slate-800",
  };
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`text-left text-white text-sm px-4 py-2.5 rounded-xl shadow-lg ${tone[t.type]} animate-[jt-fade-in_0.2s_ease-out]`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}

function AiBadge() {
  const { data } = useHealth();
  const llm = data?.llm ?? false;
  return (
    <span
      className={`text-xs font-medium px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
        llm ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500 bg-slate-50"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${llm ? "bg-emerald-500" : "bg-slate-400"}`} />
      {llm ? "AI: on" : "AI: offline"}
    </span>
  );
}

function Brand() {
  return (
    <div className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent">
      🚀 JobTrack
    </div>
  );
}

function SidebarProgress() {
  const { data: roadmap } = useRoadmap();
  if (!roadmap) return null;
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
      <div className="text-xs font-medium text-slate-600 mb-1">
        Roadmap: {roadmap.progress.done}/{roadmap.progress.total}
      </div>
      <ProgressBar value={roadmap.progress.done} max={roadmap.progress.total} tone="emerald" />
    </div>
  );
}

function navBtn(item: NavItem, compact = false) {
  const cls = ({ isActive }: { isActive: boolean }) =>
    compact
      ? `shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
        }`
      : `w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
        }`;
  return (
    <NavLink key={item.path} to={item.path} className={cls}>
      <span className={compact ? "mr-1" : "text-base w-5 text-center"}>{item.icon}</span>
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
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isError: connectionError } = useHealth();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const queryClient = useQueryClient();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const go = (t: string) => navigate(`/${t}`);
  const allItems = isAdmin ? [...ALL_ITEMS, ADMIN_ITEM] : ALL_ITEMS;

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
    if (connectionError) toast("Could not connect to the server", "error");
  }, [connectionError, toast]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-slate-200 bg-white/70 backdrop-blur-md p-3.5 gap-2.5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <Brand />
        </div>
        <AiBadge />
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors"
        >
          <span>🔎 Search…</span>
          <span className="ml-auto font-mono text-[10px] bg-slate-100 rounded px-1.5 py-0.5 text-slate-500">⌘K</span>
        </button>
        <nav className="flex flex-col gap-2.5 flex-1">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1">{group.section}</div>
              <div className="flex flex-col gap-0.5">{group.items.map((it) => navBtn(it))}</div>
            </div>
          ))}
          {isAdmin && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1">Admin</div>
              <div className="flex flex-col gap-0.5">{navBtn(ADMIN_ITEM)}</div>
            </div>
          )}
        </nav>
        <SidebarProgress />
        <Btn variant="ghost" size="sm" onClick={logOut}>
          Log out
        </Btn>
      </aside>

      {/* Mobile top nav */}
      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <Brand />
            <div className="ml-auto flex items-center gap-2">
              <AiBadge />
              <Btn variant="ghost" size="sm" onClick={() => setPaletteOpen(true)} aria-label="Open command palette">
                🔎
              </Btn>
              <Btn variant="ghost" size="sm" onClick={logOut}>
                Log out
              </Btn>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 no-scrollbar">{allItems.map((it) => navBtn(it, true))}</nav>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<CardsSkeleton count={2} />}>
              <Routes>
                <Route path="/" element={<Navigate to={DEFAULT_PATH} replace />} />
                <Route path="/dashboard" element={<Dashboard go={go} />} />
                <Route path="/vacancies" element={<Vacancies />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/analyzer" element={<Analyzer />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/plan21" element={<Plan21 />} />
                <Route path="/learn" element={<LearnPlanWrapper />} />
                <Route path="/study" element={<Study />} />
                {/* Mock Interview and Skill Radar are now tabs inside Practice/Roadmap
                    respectively (see NAV above) — old links/bookmarks still resolve. */}
                <Route path="/mock" element={<Navigate to="/study" replace />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/radar" element={<Navigate to="/roadmap" replace />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/cv" element={<CVWrapper />} />
                <Route path="/cvbuilder" element={<CvBuilderWrapper />} />
                <Route
                  path="/admin"
                  element={
                    <AdminGate>
                      <Admin />
                    </AdminGate>
                  }
                />
                <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <ToastHost />
      <CommandPalette
        items={allItems}
        actions={[{ id: "logout", icon: "🚪", label: "Log out", onRun: logOut }]}
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
              <Route path="/*" element={<AuthGate />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
