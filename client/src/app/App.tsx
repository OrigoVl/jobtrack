import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../shared/toast";
import { useToast } from "../shared/use-toast";
import { useHealth, useRoadmap } from "../shared/queries";
import { CardsSkeleton, ProgressBar } from "../shared/ui";
import { ErrorBoundary } from "../shared/error-boundary";

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
const MockInterview = lazy(() => import("../features/mock/mock").then((m) => ({ default: m.MockInterview })));
const Roadmap = lazy(() => import("../features/roadmap/roadmap").then((m) => ({ default: m.Roadmap })));
const SkillRadar = lazy(() => import("../features/analytics/charts").then((m) => ({ default: m.SkillRadar })));
const Analytics = lazy(() => import("../features/analytics/charts").then((m) => ({ default: m.Analytics })));

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
      { path: "/roadmap", icon: "🗺️", label: "Roadmap" },
      { path: "/plan21", icon: "📅", label: "21-Day Intensive" },
      { path: "/learn", icon: "📚", label: "Learning Plan" },
      { path: "/study", icon: "🧠", label: "Practice" },
      { path: "/mock", icon: "🎤", label: "Mock Interview" },
      { path: "/projects", icon: "🧩", label: "Pet Projects" },
      { path: "/radar", icon: "🎯", label: "Skill Radar" },
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
const DEFAULT_PATH = "/dashboard";
const KNOWN_PATHS = new Set(ALL_ITEMS.map((it) => it.path));

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
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
      <div className="text-xs font-medium text-slate-600 mb-1.5">
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
      : `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
        }`;
  return (
    <NavLink key={item.path} to={item.path} className={cls}>
      <span className={compact ? "mr-1" : "text-base w-5 text-center"}>{item.icon}</span>
      {item.label}
    </NavLink>
  );
}

/** Remembers the last visited tab in localStorage, so opening "/" returns the user to where they left off. */
function useRememberLastPath() {
  const location = useLocation();
  useEffect(() => {
    if (KNOWN_PATHS.has(location.pathname)) {
      localStorage.setItem("jt-tab", location.pathname.slice(1));
    }
  }, [location.pathname]);
}

function RootRedirect() {
  const saved = localStorage.getItem("jt-tab");
  const target = saved && KNOWN_PATHS.has(`/${saved}`) ? `/${saved}` : DEFAULT_PATH;
  return <Navigate to={target} replace />;
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isError: connectionError } = useHealth();
  useRememberLastPath();
  const go = (t: string) => navigate(`/${t}`);

  // Each page now owns its own loading/empty state via its own query hooks (instead of one
  // global "wait for everything"), so all that's left here is a notification for a complete
  // loss of connection to the server.
  useEffect(() => {
    if (connectionError) toast("Could not connect to the server", "error");
  }, [connectionError, toast]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-slate-200 bg-white/70 backdrop-blur-md p-4 gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <Brand />
        </div>
        <AiBadge />
        <nav className="flex flex-col gap-4 flex-1">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1">{group.section}</div>
              <div className="flex flex-col gap-0.5">{group.items.map((it) => navBtn(it))}</div>
            </div>
          ))}
        </nav>
        <SidebarProgress />
      </aside>

      {/* Mobile top nav */}
      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <Brand />
            <div className="ml-auto">
              <AiBadge />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 no-scrollbar">{ALL_ITEMS.map((it) => navBtn(it, true))}</nav>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<CardsSkeleton count={2} />}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />
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
                <Route path="/mock" element={<MockInterview />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/radar" element={<SkillRadar />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/cv" element={<CVWrapper />} />
                <Route path="/cvbuilder" element={<CvBuilderWrapper />} />
                <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <ToastHost />
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
          <Shell />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
