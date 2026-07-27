import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import type {
  Analytics,
  Company,
  FetchAllResult,
  LearnData,
  Plan21Data,
  Profile,
  ProjectsData,
  RoadmapData,
  RoadmapStatus,
  StudyState,
  Toast,
  ToastType,
  Vacancy,
} from "./types";

interface Store {
  llm: boolean;
  loading: boolean;
  error: string | null;
  vacancies: Vacancy[];
  profile: Profile | null;
  analytics: Analytics | null;
  learn: LearnData | null;
  roadmap: RoadmapData | null;
  study: StudyState | null;
  projects: ProjectsData | null;
  plan21: Plan21Data | null;
  companies: Company[];
  toasts: Toast[];
  toast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
  reload: () => Promise<void>;
  addVacancy: (v: Partial<Vacancy>) => Promise<Vacancy>;
  updateVacancy: (id: number, patch: Partial<Vacancy>) => Promise<void>;
  deleteVacancy: (id: number) => Promise<void>;
  importVacancies: (html: string) => Promise<number>;
  fetchAllVacancies: () => Promise<FetchAllResult>;
  saveProfile: (p: Profile) => Promise<void>;
  applyCvUpload: (res: { text: string; skills: string[]; domain?: string }) => Promise<void>;
  setRoadmapStatus: (tech: string, status: RoadmapStatus) => Promise<void>;
  gradeCard: (cardId: string, grade: number) => Promise<void>;
  setDrillStatus: (id: string, status: "solved" | "todo") => Promise<void>;
  generateDrills: (tech: string) => Promise<number>;
  generateCards: (topic: string) => Promise<number>;
  setProjectItem: (itemId: string, done: boolean) => Promise<void>;
  setPlanDay: (dayId: string, done: boolean) => Promise<void>;
  saveCompany: (c: Partial<Company>) => Promise<void>;
  ui: Record<string, unknown>;
  setUi: (key: string, value: unknown) => void;
}

const StoreContext = createContext<Store | null>(null);

function recomputeRoadmap(rm: RoadmapData, tech: string, status: RoadmapStatus): RoadmapData {
  const groups = rm.groups.map((g) => ({
    ...g,
    nodes: g.nodes.map((n) => (n.tech === tech ? { ...n, status } : n)),
  }));
  const all = groups.flatMap((g) => g.nodes);
  return {
    groups,
    progress: {
      done: all.filter((n) => n.status === "done").length,
      learning: all.filter((n) => n.status === "learning").length,
      total: all.length,
    },
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [llm, setLlm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [learn, setLearn] = useState<LearnData | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [study, setStudy] = useState<StudyState | null>(null);
  const [projects, setProjects] = useState<ProjectsData | null>(null);
  const [plan21, setPlan21] = useState<Plan21Data | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ui, setUiState] = useState<Record<string, unknown>>({});
  const toastId = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // усе, що залежить від стеку вакансій / профілю — перезбираємо разом,
  // щоб зміни (парсинг, CV, ручні правки) миттєво відображались усюди.
  const reloadDerived = useCallback(async () => {
    const [a, l, rm, p, pl] = await Promise.all([api.analytics(), api.learn(), api.roadmap(), api.profile(), api.plan21()]);
    setAnalytics(a);
    setLearn(l);
    setRoadmap(rm);
    setProfile(p);
    setPlan21(pl);
  }, []);

  const reload = useCallback(async () => {
    const [v, a, l, rm, p, st, c, pr, pl] = await Promise.all([
      api.vacancies(),
      api.analytics(),
      api.learn(),
      api.roadmap(),
      api.profile(),
      api.study(),
      api.companies(),
      api.projects(),
      api.plan21(),
    ]);
    setVacancies(v);
    setAnalytics(a);
    setLearn(l);
    setRoadmap(rm);
    setProfile(p);
    setStudy(st);
    setCompanies(c);
    setProjects(pr);
    setPlan21(pl);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const h = await api.health();
        if (alive) setLlm(h.llm);
        await reload();
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Помилка зʼєднання");
          toast("Не вдалося зʼєднатися з сервером", "error");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload, toast]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T> => {
      try {
        const out = await fn();
        if (okMsg) toast(okMsg, "success");
        return out;
      } catch (e) {
        toast(e instanceof Error ? e.message : "Сталася помилка", "error");
        throw e;
      }
    },
    [toast],
  );

  const addVacancy = useCallback(
    (v: Partial<Vacancy>) =>
      run(async () => {
        const row = await api.addVacancy(v);
        setVacancies((cur) => [row, ...cur]);
        await reloadDerived();
        return row;
      }, "Вакансію додано"),
    [run, reloadDerived],
  );

  const updateVacancy = useCallback(
    (id: number, patch: Partial<Vacancy>) =>
      run(async () => {
        const row = await api.updateVacancy(id, patch);
        setVacancies((cur) => cur.map((x) => (x.id === id ? row : x)));
        await reloadDerived();
      }),
    [run, reloadDerived],
  );

  const deleteVacancy = useCallback(
    (id: number) =>
      run(async () => {
        await api.deleteVacancy(id);
        setVacancies((cur) => cur.filter((x) => x.id !== id));
        await reloadDerived();
      }, "Вакансію видалено"),
    [run, reloadDerived],
  );

  const importVacancies = useCallback(
    (html: string) =>
      run(async () => {
        const res = await api.importVacancies(html);
        await reload();
        toast(res.added ? `Додано ${res.added} вакансій` : "Нових посилань не знайдено", res.added ? "success" : "info");
        return res.added;
      }),
    [run, reload, toast],
  );

  const fetchAllVacancies = useCallback(
    () =>
      run(async () => {
        const res = await api.fetchAllVacancies();
        await reload();
        toast(`Оброблено ${res.processed} вакансій — стек оновлено всюди`, "success");
        return res;
      }),
    [run, reload, toast],
  );

  const saveProfile = useCallback(
    (p: Profile) =>
      run(async () => {
        const saved = await api.saveProfile(p);
        setProfile(saved);
        await reloadDerived();
      }, "Профіль збережено"),
    [run, reloadDerived],
  );

  const applyCvUpload = useCallback(
    (res: { text: string; skills: string[]; domain?: string }) =>
      run(async () => {
        setProfile((cur) => ({ skills: res.skills, cvText: res.text, domain: res.domain ?? cur?.domain }));
        await reloadDerived();
      }),
    [run, reloadDerived],
  );

  const setRoadmapStatus = useCallback(
    (tech: string, status: RoadmapStatus) =>
      run(async () => {
        setRoadmap((cur) => (cur ? recomputeRoadmap(cur, tech, status) : cur));
        await api.setRoadmapStatus(tech, status);
      }),
    [run],
  );

  const gradeCard = useCallback(
    (cardId: string, grade: number) =>
      run(async () => {
        await api.grade(cardId, grade);
        setStudy(await api.study());
      }),
    [run],
  );

  const setDrillStatus = useCallback(
    (id: string, status: "solved" | "todo") =>
      run(async () => {
        setStudy((cur) => {
          if (!cur) return cur;
          const next = { ...cur.drillProgress };
          if (status === "solved") next[id] = "solved";
          else delete next[id];
          return { ...cur, drillProgress: next };
        });
        await api.setDrillStatus(id, status);
        setRoadmap(await api.roadmap()); // роудмапа показує прогрес задач
      }),
    [run],
  );

  const generateDrills = useCallback(
    (tech: string) =>
      run(async () => {
        const res = await api.generateDrills(tech);
        setStudy(await api.study());
        setRoadmap(await api.roadmap());
        toast(
          res.offline
            ? "AI офлайн — увімкни ключ у server/.env"
            : res.added
              ? `Додано ${res.added} нових задач під «${tech}»`
              : "Нових задач не згенеровано (усе вже є)",
          res.added ? "success" : "info",
        );
        return res.added;
      }),
    [run, toast],
  );

  const generateCards = useCallback(
    (topic: string) =>
      run(async () => {
        const res = await api.generateCards(topic);
        setStudy(await api.study());
        toast(
          res.offline
            ? "AI офлайн — увімкни ключ у server/.env"
            : res.added
              ? `Додано ${res.added} нових карток під «${topic}»`
              : "Нових карток не згенеровано (усе вже є)",
          res.added ? "success" : "info",
        );
        return res.added;
      }),
    [run, toast],
  );

  const setProjectItem = useCallback(
    (itemId: string, done: boolean) =>
      run(async () => {
        setProjects((cur) => (cur ? { ...cur, progress: { ...cur.progress, [itemId]: done } } : cur));
        await api.setProjectItem(itemId, done);
      }),
    [run],
  );

  const setPlanDay = useCallback(
    (dayId: string, done: boolean) =>
      run(async () => {
        setPlan21((cur) => (cur ? { ...cur, progress: { ...cur.progress, [dayId]: done } } : cur));
        await api.setPlanDay(dayId, done);
      }),
    [run],
  );

  const saveCompany = useCallback(
    (c: Partial<Company>) =>
      run(async () => {
        await api.saveCompany(c);
        setCompanies(await api.companies());
      }, "Збережено"),
    [run],
  );

  const setUi = useCallback((key: string, value: unknown) => setUiState((s) => ({ ...s, [key]: value })), []);

  const value: Store = {
    llm,
    loading,
    error,
    vacancies,
    profile,
    analytics,
    learn,
    roadmap,
    study,
    projects,
    plan21,
    companies,
    toasts,
    toast,
    dismissToast,
    reload,
    addVacancy,
    updateVacancy,
    deleteVacancy,
    importVacancies,
    fetchAllVacancies,
    saveProfile,
    applyCvUpload,
    setRoadmapStatus,
    gradeCard,
    setDrillStatus,
    generateDrills,
    generateCards,
    setProjectItem,
    setPlanDay,
    saveCompany,
    ui,
    setUi,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore має використовуватись усередині <StoreProvider>");
  return ctx;
}

// Персистентний UI-стан вкладок: не скидається при перемиканні табів.
export function useUi<T>(key: string, initial: T): [T, (v: T) => void] {
  const { ui, setUi } = useStore();
  const value = (key in ui ? ui[key] : initial) as T;
  const set = useCallback((v: T) => setUi(key, v), [setUi, key]);
  return [value, set];
}
