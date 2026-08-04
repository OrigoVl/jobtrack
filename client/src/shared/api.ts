import type {
  AdminLlmUsageSummary,
  AdminOverview,
  AdminProductEventsSummary,
  AdminUsersResult,
  Analytics,
  AnalyzeResult,
  CalendarEvent,
  CalendarEventInput,
  CombinedCalendar,
  Company,
  Contact,
  ContactInput,
  CvAnalysis,
  CvDoc,
  CvMatch,
  CvPreset,
  CvReview,
  CvShare,
  CvTailorResult,
  Drill,
  FetchAllResult,
  FocusWeek,
  JobSearchResult,
  JsonVacancyImportResult,
  KnowledgeData,
  LearnData,
  LinkedInOptimizeResult,
  MockEvaluation,
  Plan21Data,
  Profile,
  ProjectsData,
  ResourcesData,
  RoadmapData,
  RoadmapStatus,
  SavedSearch,
  SavedSearchInput,
  StudyState,
  Vacancy,
} from "./types";
import i18n from "../i18n";

const base = "/api";
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

// A 401 here means the session expired/was revoked mid-use (the initial route gate in
// app/App.tsx already keeps a signed-out user from reaching these calls at all) — a hard
// reload to /login is deliberate: it clears the TanStack Query cache and any in-memory state as
// a side effect, the same guarantee an explicit logout gives, without duplicating that logic here.
function handleUnauthorized(): void {
  if (!PUBLIC_PATHS.includes(window.location.pathname)) {
    window.location.href = "/login";
  }
}

// Shared by every fetch call site below (the JSON path in req(), and the two FormData uploads
// that can't go through req() itself — see importLinkedIn/uploadCV) so the 401/error-body
// handling lives in exactly one place.
async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    // `code` (server/src/core/http.ts's HttpError optional 4th param, surfaced by
    // core/error-handler.ts / core/rate-limit.ts) lets shared/use-error-toast.ts show a
    // translated message for the handful of error sites a normal user can trigger, instead of
    // always showing the raw (English-only) `message`.
    const err = new Error(body.error || `HTTP ${res.status}`) as Error & { code?: string };
    err.code = body.code;
    throw err;
  }
  return res.json() as Promise<T>;
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const { headers, ...rest } = opts;
  const res = await fetch(base + path, {
    // x-locale: read server-side (server/src/core/request-context.ts) to pick the language for
    // AI-generated prose (server/src/llm/client.ts's opt-in outputLocale) and any pre-translated
    // static content — see the i18n plan's Phase A Step 6.
    headers: { "content-type": "application/json", "x-locale": i18n.language, ...(headers as Record<string, string> | undefined) },
    ...rest,
  });
  return handleResponse<T>(res);
}

export const api = {
  health: () => req<{ ok: boolean; db: boolean; llm: boolean }>("/health"),
  authConfig: () => req<{ googleEnabled: boolean }>("/auth-config"),

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
  fetchVacancyUrl: (url: string) => req<{ text: string }>("/vacancies/fetch-url", { method: "POST", body: JSON.stringify({ url }) }),
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
  tailorCv: (doc: CvDoc, jobTitle: string, jobText: string) =>
    req<CvTailorResult>("/cv/tailor", { method: "POST", body: JSON.stringify({ doc, jobTitle, jobText }) }),
  cvPresets: () => req<{ presets: CvPreset[] }>("/cv/presets"),
  saveCvPresets: (presets: CvPreset[]) => req<{ presets: CvPreset[] }>("/cv/presets", { method: "PUT", body: JSON.stringify({ presets }) }),
  generateCvDoc: (cvText: string) =>
    req<{ offline?: boolean; doc: CvDoc }>("/cv/doc/generate", { method: "POST", body: JSON.stringify({ cvText }) }),
  improveCv: (text: string, kind: "bullet" | "summary", style?: "improve" | "shorter" | "ats" | "technical" | "leadership") =>
    req<{ text: string; offline?: boolean }>("/cv/improve", { method: "POST", body: JSON.stringify({ text, kind, style }) }),
  searchJobs: (q: string, region = "all") => req<JobSearchResult>(`/jobs/search?q=${encodeURIComponent(q)}&region=${region}`),
  importLinkedIn: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    // No "content-type" here — the browser sets its own multipart boundary for FormData; setting
    // one manually would break the upload.
    const res = await fetch(`${base}/cv/linkedin-import`, { method: "POST", body: fd, headers: { "x-locale": i18n.language } });
    return handleResponse<{ doc: CvDoc }>(res);
  },
  uploadCV: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${base}/cv/upload`, { method: "POST", body: fd, headers: { "x-locale": i18n.language } });
    return handleResponse<{ text: string; skills: string[]; detected: string[]; domain?: string; cvDoc?: CvDoc | null } & CvAnalysis>(res);
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

  adminOverview: (days = 30) => req<AdminOverview>(`/admin/overview?days=${days}`),
  adminUsers: (limit = 50, offset = 0) => req<AdminUsersResult>(`/admin/users?limit=${limit}&offset=${offset}`),
  adminLlmUsage: (days = 30) => req<AdminLlmUsageSummary>(`/admin/llm-usage?days=${days}`),
  adminProductEvents: (days = 30) => req<AdminProductEventsSummary>(`/admin/product-events?days=${days}`),

  calendarCombined: (range: { from?: string; to?: string } = {}) => {
    const q = new URLSearchParams();
    if (range.from) q.set("from", range.from);
    if (range.to) q.set("to", range.to);
    const qs = q.toString();
    return req<CombinedCalendar>(`/calendar/combined${qs ? `?${qs}` : ""}`);
  },
  addCalendarEvent: (e: CalendarEventInput) => req<CalendarEvent>("/calendar/events", { method: "POST", body: JSON.stringify(e) }),
  updateCalendarEvent: (id: number, patch: Partial<CalendarEventInput>) =>
    req<CalendarEvent>(`/calendar/events/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteCalendarEvent: (id: number) => req<{ ok: boolean; deleted: number }>(`/calendar/events/${id}`, { method: "DELETE" }),

  savedSearches: () => req<SavedSearch[]>("/saved-searches"),
  addSavedSearch: (s: SavedSearchInput) => req<SavedSearch>("/saved-searches", { method: "POST", body: JSON.stringify(s) }),
  deleteSavedSearch: (id: number) => req<{ ok: boolean; deleted: number }>(`/saved-searches/${id}`, { method: "DELETE" }),

  contacts: () => req<Contact[]>("/contacts"),
  addContact: (c: Partial<ContactInput>) => req<Contact>("/contacts", { method: "POST", body: JSON.stringify(c) }),
  updateContact: (id: number, patch: Partial<ContactInput>) =>
    req<Contact>(`/contacts/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteContact: (id: number) => req<{ ok: boolean; deleted: number }>(`/contacts/${id}`, { method: "DELETE" }),

  cvShare: () => req<CvShare | null>("/cv/share"),
  generateCvShare: () => req<CvShare>("/cv/share", { method: "POST" }),
  setCvShareEnabled: (enabled: boolean) => req<CvShare>("/cv/share", { method: "PUT", body: JSON.stringify({ enabled }) }),
  // Public — no session required, matches the server route not being behind authed(). Still
  // goes through the same `req()` helper (nothing about it depends on a cookie being present).
  cvPublic: (slug: string) => req<{ doc: CvDoc }>(`/cv/public/${encodeURIComponent(slug)}`),

  linkedinOptimize: () => req<LinkedInOptimizeResult>("/cv/linkedin-optimize", { method: "POST", body: "{}" }),
};
