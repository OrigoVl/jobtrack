import type {
  AdminBillingSummary,
  AdminLlmUsageSummary,
  AdminOverview,
  AdminProductEventsSummary,
  AdminUsersResult,
  Analytics,
  AnalyzeResult,
  ApiToken,
  ApiTokenCreated,
  ApiTokenInput,
  ApplyProgress,
  BillingState,
  CalendarEvent,
  CalendarEventInput,
  CheckoutPlan,
  CombinedCalendar,
  Company,
  Contact,
  ContactInput,
  CvAnalysis,
  CvDoc,
  CvMatch,
  CvPreset,
  CvProfile,
  CvProfileFull,
  CvAuditJobState,
  CvShare,
  CvTailorResult,
  DesignArchiveEntry,
  DesignDefenseTurnResult,
  DesignDiagram,
  DesignExercise,
  DesignGrade,
  DesignHistoryEntry,
  DesignTask,
  DigestPreferences,
  Drill,
  DrillArchiveEntry,
  PostingContact,
  SiteContactsResult,
  FetchAllJobState,
  FocusWeek,
  InterviewTurnResult,
  JobSearchResult,
  JsonVacancyImportResult,
  KnowledgeData,
  LearnData,
  LinkedInOptimizeResult,
  MockEvaluation,
  OnboardingState,
  NotificationSettings,
  OutreachResult,
  Plan21Data,
  Profile,
  ProjectsData,
  ReferralState,
  ResourcesData,
  RoadmapData,
  RoadmapStatus,
  SavedLinkedInProfile,
  SavedSearch,
  SavedSearchInput,
  SimilarVacancy,
  StudyState,
  Vacancy,
  VacancyDetails,
} from "./types";
import type { AppLocale } from "../i18n/locales";
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

// Advisory header set by server/src/app.ts (fed by llm/client.ts's plan-quota check via
// core/request-context.ts's markAiQuotaExceeded()) on ANY AI response once a Free-plan user
// hits their monthly quota — the response body itself is untouched (the offline-fallback result
// still ships), so this is purely additive metadata an unaware caller ignores. Dispatched as a
// DOM event rather than threaded through every one of the ~26 AI call sites' return types; see
// shared/ai-quota-notifier.tsx, the sole listener.
export const AI_QUOTA_EXCEEDED_EVENT = "zorya:ai-quota-exceeded";

// Shared by every fetch call site below (the JSON path in req(), and the two FormData uploads
// that can't go through req() itself — see importLinkedIn/uploadCV) so the 401/error-body
// handling lives in exactly one place.
async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) handleUnauthorized();
  // Optional chaining: a real fetch() Response always has `.headers`, but several existing
  // tests (api.test.ts) mock a bare `{ ok, status, json }` object without one — this stays a
  // no-op there instead of throwing on an unrelated advisory check.
  if (res.headers?.get("X-AI-Quota-Exceeded")) window.dispatchEvent(new Event(AI_QUOTA_EXCEEDED_EVENT));
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
  authConfig: () => req<{ googleEnabled: boolean; linkedinEnabled: boolean }>("/auth-config"),

  vacancies: () => req<Vacancy[]>("/vacancies"),
  addVacancy: (v: Partial<Vacancy>) =>
    req<Vacancy & { possibleDuplicateOf: { id: number; company: string; position: string } | null }>("/vacancies", {
      method: "POST",
      body: JSON.stringify(v),
    }),
  updateVacancy: (id: number, v: Partial<Vacancy>) => req<Vacancy>(`/vacancies/${id}`, { method: "PUT", body: JSON.stringify(v) }),
  deleteVacancy: (id: number) => req<{ ok: boolean }>(`/vacancies/${id}`, { method: "DELETE" }),
  analyzeVacancy: (text: string) => req<AnalyzeResult>("/vacancies/analyze", { method: "POST", body: JSON.stringify({ text }) }),
  fetchVacancyDetails: (url: string) => req<VacancyDetails>("/vacancies/fetch-details", { method: "POST", body: JSON.stringify({ url }) }),
  importVacancies: (html: string) =>
    req<{
      added: number;
      items: { company: string; url: string }[];
      possibleDuplicates: { company: string; url: string; of: { id: number; company: string; position: string } }[];
    }>("/vacancies/import", {
      method: "POST",
      body: JSON.stringify({ html }),
    }),
  fetchAllVacancies: () => req<FetchAllJobState>("/vacancies/fetch-all", { method: "POST", body: "{}" }),
  fetchAllStatus: () => req<FetchAllJobState | null>("/vacancies/fetch-all/status"),
  fetchVacancyUrl: (url: string) => req<{ text: string }>("/vacancies/fetch-url", { method: "POST", body: JSON.stringify({ url }) }),
  importVacanciesJson: (items: unknown[]) =>
    req<JsonVacancyImportResult>("/vacancies/import-json", { method: "POST", body: JSON.stringify(items) }),
  exportVacancies: () => req<Record<string, string>[]>("/vacancies/export"),
  similarVacancies: (id: number) => req<{ similar: SimilarVacancy[] }>(`/vacancies/${id}/similar`),
  applyProgress: () => req<ApplyProgress>("/vacancies/apply-progress"),
  setWeeklyApplyGoal: (weekly: number) =>
    req<{ weeklyGoal: number }>("/vacancies/apply-goal", { method: "PUT", body: JSON.stringify({ weekly }) }),

  profile: () => req<Profile>("/profile"),
  saveProfile: (p: Profile) => req<Profile>("/profile", { method: "PUT", body: JSON.stringify(p) }),
  analyzeCV: (cvText: string) => req<CvAnalysis>("/cv/analyze", { method: "POST", body: JSON.stringify({ cvText }) }),
  startCvAuditJob: (doc: CvDoc, known: string[]) =>
    req<CvAuditJobState>("/cv/audit/start", { method: "POST", body: JSON.stringify({ doc, known }) }),
  cvAuditJobStatus: () => req<CvAuditJobState | null>("/cv/audit/status"),
  cvProfiles: () => req<CvProfile[]>("/cv/profiles"),
  createCvProfile: (name: string) => req<CvProfileFull>("/cv/profiles", { method: "POST", body: JSON.stringify({ name }) }),
  duplicateCvProfile: (id: number) => req<CvProfileFull>(`/cv/profiles/${id}/duplicate`, { method: "POST" }),
  renameCvProfile: (id: number, name: string) => req<CvProfile>(`/cv/profiles/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteCvProfile: (id: number) => req<{ ok: boolean }>(`/cv/profiles/${id}`, { method: "DELETE" }),
  cvDoc: (profileId: number) => req<CvDoc>(`/cv/profiles/${profileId}/doc`),
  saveCvDoc: (profileId: number, doc: CvDoc) => req<CvDoc>(`/cv/profiles/${profileId}/doc`, { method: "PUT", body: JSON.stringify(doc) }),
  matchVacancy: (cvText: string, jobTitle: string, jobText: string) =>
    req<CvMatch>("/cv/match", { method: "POST", body: JSON.stringify({ cvText, jobTitle, jobText }) }),
  tailorCv: (doc: CvDoc, jobTitle: string, jobText: string) =>
    req<CvTailorResult>("/cv/tailor", { method: "POST", body: JSON.stringify({ doc, jobTitle, jobText }) }),
  cvPresets: (profileId: number) => req<{ presets: CvPreset[] }>(`/cv/profiles/${profileId}/presets`),
  saveCvPresets: (profileId: number, presets: CvPreset[]) =>
    req<{ presets: CvPreset[] }>(`/cv/profiles/${profileId}/presets`, { method: "PUT", body: JSON.stringify({ presets }) }),
  generateCvDoc: (profileId: number, cvText: string) =>
    req<{ offline?: boolean; doc: CvDoc }>(`/cv/profiles/${profileId}/doc/generate`, { method: "POST", body: JSON.stringify({ cvText }) }),
  improveCv: (
    text: string,
    kind: "bullet" | "summary",
    style?: "improve" | "shorter" | "ats" | "technical" | "leadership" | "positioning",
  ) => req<{ text: string; offline?: boolean }>("/cv/improve", { method: "POST", body: JSON.stringify({ text, kind, style }) }),
  searchJobs: (q: string, region = "all") => req<JobSearchResult>(`/jobs/search?q=${encodeURIComponent(q)}&region=${region}`),
  importLinkedIn: async (profileId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    // No "content-type" here — the browser sets its own multipart boundary for FormData; setting
    // one manually would break the upload.
    const res = await fetch(`${base}/cv/profiles/${profileId}/linkedin-import`, {
      method: "POST",
      body: fd,
      headers: { "x-locale": i18n.language },
    });
    return handleResponse<{ doc: CvDoc }>(res);
  },
  uploadCV: async (profileId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${base}/cv/profiles/${profileId}/upload`, {
      method: "POST",
      body: fd,
      headers: { "x-locale": i18n.language },
    });
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
  setSkillLevel: (tech: string, level: number | null) =>
    req<{ ok: boolean; levels: Record<string, number> }>("/roadmap/level", { method: "PUT", body: JSON.stringify({ tech, level }) }),
  knowledge: (tech: string) => req<KnowledgeData>(`/knowledge/${encodeURIComponent(tech)}`),

  resources: () => req<ResourcesData>("/resources"),
  /** An empty `text` clears the override and puts the focus back on auto. */
  setResourcesFocus: (text: string) =>
    req<{ ok: boolean; focus: string; focusCustom: boolean }>("/resources/focus", { method: "PUT", body: JSON.stringify({ text }) }),

  study: async (): Promise<StudyState> => {
    const [due, content] = await Promise.all([
      req<{ due: StudyState["due"]; total: number; learned: number; streak: StudyState["streak"] }>("/study/due"),
      req<{ drills: StudyState["drills"]; drillProgress: Record<string, string> }>("/study/content"),
    ]);
    return {
      due: due.due,
      total: due.total,
      learned: due.learned,
      streak: due.streak,
      drills: content.drills,
      drillProgress: content.drillProgress,
    };
  },
  grade: (cardId: string, grade: number) =>
    req<{ ok: boolean }>("/study/grade", { method: "POST", body: JSON.stringify({ cardId, grade }) }),
  setDrillStatus: (id: string, status: "solved" | "todo") =>
    req<{ ok: boolean }>("/study/drill", { method: "PUT", body: JSON.stringify({ id, status }) }),
  drillArchive: () => req<DrillArchiveEntry[]>("/study/archive"),
  updateDrillArchiveEntry: (id: string, patch: Partial<Pick<DrillArchiveEntry, "q" | "sol" | "exp">>) =>
    req<DrillArchiveEntry>(`/study/archive/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteDrillArchiveEntry: (id: string) => req<{ ok: boolean }>(`/study/archive/${id}`, { method: "DELETE" }),
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
  /** Upserts a company auto-derived from a vacancy link, returning the row so the caller can link
   * the vacancy to it. Unlike saveCompany, it never overwrites notes/questions/website the user
   * already filled in — see upsertCompanyEnrichment on the server. */
  enrichCompany: (c: Partial<Company>) => req<Company>("/companies/enrich", { method: "POST", body: JSON.stringify(c) }),
  updateCompany: (id: number, c: Partial<Company>) => req<Company>(`/companies/${id}`, { method: "PUT", body: JSON.stringify(c) }),
  deleteCompany: (id: number) => req<{ ok: boolean; deleted: number }>(`/companies/${id}`, { method: "DELETE" }),

  coverLetter: (vacancyText: string, company: string, details?: string) =>
    req<{ text: string; offline?: boolean }>("/llm/cover-letter", {
      method: "POST",
      body: JSON.stringify({ vacancyText, company, details }),
    }),

  evaluateMock: (question: string, answer: string, reference: string) =>
    req<MockEvaluation>("/mock/evaluate", { method: "POST", body: JSON.stringify({ question, answer, reference }) }),
  interviewTurn: (vacancyId: number | null, transcript: { q: string; a: string }[], maxTurns: number) =>
    req<InterviewTurnResult>("/mock/interview", { method: "POST", body: JSON.stringify({ vacancyId, transcript, maxTurns }) }),
  // Cloud neural TTS for the voice mock interview (see mock/speech.ts's speak()). Doesn't go
  // through req() — the response is raw audio bytes on success, not JSON, and a 204 ("cloud TTS
  // unavailable: no key / cost cap / call failed") is an expected fallback signal, not an error —
  // so this never throws, it just resolves to `null` and lets the caller fall back to
  // speechSynthesis. Same non-standard-fetch style as importLinkedIn/uploadCV above.
  speakViaCloudTts: async (text: string): Promise<Blob | null> => {
    try {
      const res = await fetch(`${base}/mock/speak`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-locale": i18n.language },
        body: JSON.stringify({ text }),
      });
      if (res.status === 204 || !res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  },

  adminOverview: (days = 30) => req<AdminOverview>(`/admin/overview?days=${days}`),
  adminUsers: (limit = 50, offset = 0, search = "") =>
    req<AdminUsersResult>(`/admin/users?limit=${limit}&offset=${offset}${search ? `&search=${encodeURIComponent(search)}` : ""}`),
  adminLlmUsage: (days = 30) => req<AdminLlmUsageSummary>(`/admin/llm-usage?days=${days}`),
  adminProductEvents: (days = 30) => req<AdminProductEventsSummary>(`/admin/product-events?days=${days}`),
  adminBilling: (days = 30) => req<AdminBillingSummary>(`/admin/billing?days=${days}`),
  adminBanUser: (userId: string, reason?: string) =>
    req<{ ok: boolean }>(`/admin/users/${userId}/ban`, { method: "POST", body: JSON.stringify({ reason }) }),
  adminUnbanUser: (userId: string) => req<{ ok: boolean }>(`/admin/users/${userId}/unban`, { method: "POST" }),
  adminGrantPlan: (userId: string, plan: "pro" | "team", days: number) =>
    req<{ ok: boolean }>(`/admin/users/${userId}/grant-plan`, { method: "POST", body: JSON.stringify({ plan, days }) }),
  adminGrantBonusAiCalls: (userId: string, count: number) =>
    req<{ ok: boolean; total: number }>(`/admin/users/${userId}/grant-bonus-ai-calls`, {
      method: "POST",
      body: JSON.stringify({ count }),
    }),

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
  contactOutreach: (id: number, kind: "intro" | "followup") =>
    req<OutreachResult>(`/contacts/${id}/outreach`, { method: "POST", body: JSON.stringify({ kind }) }),
  extractPostingContacts: (input: { vacancyId?: number; text?: string }) =>
    req<{ contacts: PostingContact[] }>("/contacts/extract", { method: "POST", body: JSON.stringify(input) }),
  scanCompanySite: (companyId: number) =>
    req<SiteContactsResult>("/contacts/site-scan", { method: "POST", body: JSON.stringify({ companyId }) }),
  cvShare: (profileId: number) => req<CvShare | null>(`/cv/profiles/${profileId}/share`),
  generateCvShare: (profileId: number) => req<CvShare>(`/cv/profiles/${profileId}/share`, { method: "POST" }),
  setCvShareEnabled: (profileId: number, enabled: boolean) =>
    req<CvShare>(`/cv/profiles/${profileId}/share`, { method: "PUT", body: JSON.stringify({ enabled }) }),
  // Public — no session required, matches the server route not being behind authed(). Still
  // goes through the same `req()` helper (nothing about it depends on a cookie being present).
  cvPublic: (slug: string) => req<{ doc: CvDoc }>(`/cv/public/${encodeURIComponent(slug)}`),

  /** `current` is the profile the user already has on LinkedIn, pasted by hand — with it the
   * response also carries a scored audit and the rewrite builds on what's there. */
  linkedinSaved: () => req<SavedLinkedInProfile | null>("/cv/linkedin-profile"),
  linkedinOptimize: (language: AppLocale, current?: { headline: string; about: string }) =>
    req<LinkedInOptimizeResult>("/cv/linkedin-optimize", { method: "POST", body: JSON.stringify({ language, current }) }),

  digestPreferences: () => req<DigestPreferences>("/digest/preferences"),
  setDigestEnabled: (enabled: boolean) =>
    req<DigestPreferences>("/digest/preferences", { method: "PUT", body: JSON.stringify({ enabled }) }),

  designCurrent: () => req<DesignExercise | null>("/design/current"),
  designTask: (vacancyId?: number) =>
    req<{ offline?: boolean; task: DesignTask | null }>("/design/task", { method: "POST", body: JSON.stringify({ vacancyId }) }),
  designGrade: (task: DesignTask, diagram: DesignDiagram) =>
    req<DesignGrade>("/design/grade", { method: "POST", body: JSON.stringify({ task, diagram }) }),
  designHelp: (task: DesignTask, diagram: DesignDiagram, question: string) =>
    req<{ offline?: boolean; answer: string }>("/design/help", { method: "POST", body: JSON.stringify({ task, diagram, question }) }),
  designHistory: () => req<DesignHistoryEntry[]>("/design/history"),
  designArchive: () => req<DesignArchiveEntry[]>("/design/archive"),
  updateDesignArchiveEntry: (id: string, patch: Partial<{ title: string; scenario: string; summary: string; tip: string }>) =>
    req<DesignArchiveEntry>(`/design/archive/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteDesignArchiveEntry: (id: string) => req<{ ok: boolean }>(`/design/archive/${id}`, { method: "DELETE" }),
  designDefense: (task: DesignTask, diagram: DesignDiagram, transcript: { q: string; a: string }[], maxTurns: number) =>
    req<DesignDefenseTurnResult>("/design/defense", {
      method: "POST",
      body: JSON.stringify({ task, diagram, transcript, maxTurns }),
    }),

  telegramStatus: () => req<{ linked: boolean }>("/telegram/status"),
  createTelegramLinkToken: () => req<{ deepLink: string }>("/telegram/link-token", { method: "POST", body: "{}" }),
  unlinkTelegram: () => req<{ linked: boolean }>("/telegram/unlink", { method: "POST", body: "{}" }),

  notificationSettings: () => req<NotificationSettings>("/notifications/settings"),
  saveNotificationSettings: (prefs: Record<string, boolean>) =>
    req<NotificationSettings>("/notifications/settings", {
      method: "PUT",
      // The timezone rides along with every save rather than having an endpoint of its own: the
      // user never sets it, it's just whatever their browser currently reports, and this is the one
      // request where they're already telling the server about their notification setup.
      body: JSON.stringify({ prefs, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    }),

  referralState: () => req<ReferralState>("/referrals/me"),
  claimReferral: (code: string) => req<{ claimed: boolean }>("/referrals/claim", { method: "POST", body: JSON.stringify({ code }) }),

  onboardingState: () => req<OnboardingState>("/onboarding/state"),
  markWelcomeSeen: () => req<{ welcomeSeen: boolean }>("/onboarding/welcome-seen", { method: "POST", body: "{}" }),

  billingMe: () => req<BillingState>("/billing/me"),
  createCheckout: (plan: CheckoutPlan) => req<{ url: string }>("/billing/checkout", { method: "POST", body: JSON.stringify({ plan }) }),
  openBillingPortal: () => req<{ url: string }>("/billing/portal", { method: "POST", body: "{}" }),

  apiTokens: () => req<ApiToken[]>("/mcp/tokens"),
  createApiToken: (input: ApiTokenInput) => req<ApiTokenCreated>("/mcp/tokens", { method: "POST", body: JSON.stringify(input) }),
  revokeApiToken: (id: number) => req<{ ok: boolean }>(`/mcp/tokens/${id}`, { method: "DELETE" }),
};
