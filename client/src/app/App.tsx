import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider, useToast } from "../shared/toast";
import { useHealth, useRoadmap } from "../shared/queries";
import { CardsSkeleton, ProgressBar } from "../shared/ui";
import { ErrorBoundary } from "../shared/error-boundary";
import { Dashboard } from "../features/dashboard/dashboard";
import { Vacancies } from "../features/vacancies/vacancies";
import { Analyzer } from "../features/analyzer/analyzer";
import { Study } from "../features/study/study";
import { CVView } from "../features/cv/cv";
import { CvBuilder } from "../features/cv/cv-builder";
import { Companies } from "../features/companies/companies";
import { Jobs } from "../features/jobs/jobs";
import { LearnPlan } from "../features/knowledge/learn";
import { Resources } from "../features/resources/resources";
import { Projects } from "../features/projects/projects";
import { Plan21 } from "../features/plan21/plan21";
import { MockInterview } from "../features/mock/mock";
import { Roadmap } from "../features/roadmap/roadmap";

const SkillRadar = lazy(() => import("../features/analytics/charts").then((m) => ({ default: m.SkillRadar })));
const Analytics = lazy(() => import("../features/analytics/charts").then((m) => ({ default: m.Analytics })));

type NavItem = { path: string; icon: string; label: string };
const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Пошук роботи",
    items: [
      { path: "/dashboard", icon: "🏠", label: "Дашборд" },
      { path: "/vacancies", icon: "📋", label: "Вакансії" },
      { path: "/jobs", icon: "🔎", label: "Пошук вакансій" },
      { path: "/analyzer", icon: "🔍", label: "Аналіз вакансії" },
      { path: "/companies", icon: "🏢", label: "Компанії" },
      { path: "/analytics", icon: "📊", label: "Аналітика" },
    ],
  },
  {
    section: "Розвиток",
    items: [
      { path: "/roadmap", icon: "🗺️", label: "Роудмапа" },
      { path: "/plan21", icon: "📅", label: "Інтенсив 21 день" },
      { path: "/learn", icon: "📚", label: "План навчання" },
      { path: "/study", icon: "🧠", label: "Тренування" },
      { path: "/mock", icon: "🎤", label: "Мок-інтерв'ю" },
      { path: "/projects", icon: "🧩", label: "Pet-проєкти" },
      { path: "/radar", icon: "🎯", label: "Skill-radar" },
      { path: "/resources", icon: "📖", label: "Ресурси" },
    ],
  },
  {
    section: "Профіль",
    items: [
      { path: "/cv", icon: "📄", label: "CV" },
      { path: "/cvbuilder", icon: "🛠", label: "Конструктор CV" },
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
      {llm ? "AI: увімкнено" : "AI: офлайн"}
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
        Роудмапа: {roadmap.progress.done}/{roadmap.progress.total}
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

/** Пам'ятає останню відвідану вкладку в localStorage, щоб при відкритті "/" повернути користувача туди, де він зупинився. */
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

  // Кожна сторінка тепер сама тримає свій loading/empty-стан через власні query-хуки
  // (замість одного глобального "чекаємо на все"), тож тут лишається лише сповіщення
  // про повну відсутність звʼязку із сервером.
  useEffect(() => {
    if (connectionError) toast("Не вдалося зʼєднатися з сервером", "error");
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
            staleTime: 5 * 60 * 1000, // 5 хв — дані агрегаторів/зовнішніх пошуків не змінюються щохвилини
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
