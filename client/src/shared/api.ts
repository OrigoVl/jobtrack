import type {
  Analytics,
  AnalyzeResult,
  Company,
  CvAnalysis,
  CvDoc,
  CvMatch,
  CvPreset,
  CvReview,
  Drill,
  FetchAllResult,
  FocusWeek,
  JobSearchResult,
  JsonVacancyImportResult,
  KnowledgeData,
  LearnData,
  MockEvaluation,
  Plan21Data,
  Profile,
  ProjectsData,
  ResourcesData,
  RoadmapData,
  RoadmapStatus,
  StudyState,
  Vacancy,
} from "./types";

const base = "/api";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(base + path, {
    headers: { "content-type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ ok: boolean; db: boolean; llm: boolean }>("/health"),

  vacancies: () => req<Vacancy[]>("/vacancies"),
  addVacancy: (v: Partial<Vacancy>) => req<Vacancy>("/vacancies", { method: "POST", body: JSON.stringify(v) }),
  updateVacancy: (id: number, v: Partial<Vacancy>) => req<Vacancy>(`/vacancies/${id}`, { method: "PUT", body: JSON.stringify(v) }),
  deleteVacancy: (id: number) => req<{ ok: boolean }>(`/vacancies/${id}`, { method: "DELETE" }),
  analyzeVacancy: (text: string) => req<AnalyzeResult>("/vacancies/analyze", { method: "POST", body: JSON.stringify({ text }) }),
  importVacancies: (html: string) =>
    req<{ added: number; items: { company: string; url: string }[] }>("/vacancies/import", {
      method: "POST",
      body: JSON.stringify({ html }),
    }),
  fetchAllVacancies: () => req<FetchAllResult>("/vacancies/fetch-all", { method: "POST", body: "{}" }),
  importVacanciesJson: (items: unknown[]) =>
    req<JsonVacancyImportResult>("/vacancies/import-json", { method: "POST", body: JSON.stringify(items) }),
  exportVacancies: () => req<Record<string, string>[]>("/vacancies/export"),

  profile: () => req<Profile>("/profile"),
  saveProfile: (p: Profile) => req<Profile>("/profile", { method: "PUT", body: JSON.stringify(p) }),
  analyzeCV: (cvText: string) => req<CvAnalysis>("/cv/analyze", { method: "POST", body: JSON.stringify({ cvText }) }),
  reviewCV: (cvText: string) => req<CvReview>("/cv/review", { method: "POST", body: JSON.stringify({ cvText }) }),
  cvDoc: () => req<CvDoc>("/cv/doc"),
  saveCvDoc: (doc: CvDoc) => req<CvDoc>("/cv/doc", { method: "PUT", body: JSON.stringify(doc) }),
  matchVacancy: (cvText: string, jobTitle: string, jobText: string) =>
    req<CvMatch>("/cv/match", { method: "POST", body: JSON.stringify({ cvText, jobTitle, jobText }) }),
  cvPresets: () => req<{ presets: CvPreset[] }>("/cv/presets"),
  saveCvPresets: (presets: CvPreset[]) => req<{ presets: CvPreset[] }>("/cv/presets", { method: "PUT", body: JSON.stringify({ presets }) }),
  generateCvDoc: (cvText: string) =>
    req<{ offline?: boolean; doc: CvDoc }>("/cv/doc/generate", { method: "POST", body: JSON.stringify({ cvText }) }),
  improveCv: (text: string, kind: "bullet" | "summary") =>
    req<{ text: string; offline?: boolean }>("/cv/improve", { method: "POST", body: JSON.stringify({ text, kind }) }),
  searchJobs: (q: string, region = "all") => req<JobSearchResult>(`/jobs/search?q=${encodeURIComponent(q)}&region=${region}`),
  importLinkedIn: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${base}/cv/linkedin-import`, { method: "POST", body: fd });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ doc: CvDoc }>;
  },
  uploadCV: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${base}/cv/upload`, { method: "POST", body: fd });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<
      { text: string; skills: string[]; detected: string[]; domain?: string; cvDoc?: CvDoc | null } & CvAnalysis
    >;
  },
  skillsUpdate: (completed: string[]) =>
    req<{ skills: string[]; text: string }>("/cv/skills-update", { method: "POST", body: JSON.stringify({ completed }) }),

  analytics: () => req<Analytics>("/analytics"),
  focusWeek: () => req<FocusWeek>("/insights/focus"),
  learn: () => req<LearnData>("/learn"),
  learnPlan: () => req<{ plan: string | null; offline?: boolean }>("/learn/plan", { method: "POST", body: "{}" }),

  roadmap: () => req<RoadmapData>("/roadmap"),
  setRoadmapStatus: (tech: string, status: RoadmapStatus) =>
    req<{ ok: boolean }>("/roadmap/progress", { method: "PUT", body: JSON.stringify({ tech, status }) }),
  knowledge: (tech: string) => req<KnowledgeData>(`/knowledge/${encodeURIComponent(tech)}`),

  resources: () => req<ResourcesData>("/resources"),

  study: async (): Promise<StudyState> => {
    const [due, content] = await Promise.all([
      req<{ due: StudyState["due"]; total: number; learned: number }>("/study/due"),
      req<{ drills: StudyState["drills"]; drillProgress: Record<string, string> }>("/study/content"),
    ]);
    return { due: due.due, total: due.total, learned: due.learned, drills: content.drills, drillProgress: content.drillProgress };
  },
  grade: (cardId: string, grade: number) =>
    req<{ ok: boolean }>("/study/grade", { method: "POST", body: JSON.stringify({ cardId, grade }) }),
  setDrillStatus: (id: string, status: "solved" | "todo") =>
    req<{ ok: boolean }>("/study/drill", { method: "PUT", body: JSON.stringify({ id, status }) }),
  drillHint: (id: string) =>
    req<{ offline?: boolean; hints: string[] }>("/study/drill-hint", { method: "POST", body: JSON.stringify({ id }) }),
  generateDrills: (tech: string) =>
    req<{ offline?: boolean; added: number; drills: Drill[] }>("/study/generate", { method: "POST", body: JSON.stringify({ tech }) }),
  generateCards: (topic: string) =>
    req<{ offline?: boolean; added: number }>("/study/generate-cards", { method: "POST", body: JSON.stringify({ topic }) }),

  projects: () => req<ProjectsData>("/projects"),
  setProjectItem: (itemId: string, done: boolean) =>
    req<{ ok: boolean }>("/projects/progress", { method: "PUT", body: JSON.stringify({ itemId, done }) }),

  plan21: () => req<Plan21Data>("/plan21"),
  setPlanDay: (dayId: string, done: boolean) =>
    req<{ ok: boolean }>("/plan21/progress", { method: "PUT", body: JSON.stringify({ dayId, done }) }),

  companies: () => req<Company[]>("/companies"),
  saveCompany: (c: Partial<Company>) => req<{ ok: boolean }>("/companies", { method: "POST", body: JSON.stringify(c) }),

  coverLetter: (vacancyText: string, company: string) =>
    req<{ text: string; offline?: boolean }>("/llm/cover-letter", {
      method: "POST",
      body: JSON.stringify({ vacancyText, company }),
    }),

  evaluateMock: (question: string, answer: string, reference: string) =>
    req<MockEvaluation>("/mock/evaluate", { method: "POST", body: JSON.stringify({ question, answer, reference }) }),
};
