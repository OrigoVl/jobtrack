import type { Track } from "./tracks";

export type Fit = "high" | "med" | "low";
export type RoadmapStatus = "todo" | "learning" | "done";
export type ToastType = "success" | "error" | "info";

export const STATUSES = [
  "Want to apply",
  "Applied",
  "Screening",
  "Tech interview",
  "Take-home task",
  "Final",
  "Offer",
  "Rejected",
  "Paused",
  "Removed",
] as const;
export type VacancyStatus = (typeof STATUSES)[number];

export interface Vacancy {
  id: number;
  company: string;
  /** Linked company record (see shared/queries/companies.ts), or null — a plain free-text
   * `company` name with no first-class Company row behind it. */
  companyId: number | null;
  position: string;
  level: string;
  salary: string;
  url: string;
  status: string;
  fit: Fit;
  applied: string;
  next: string;
  /** What to actually do about `next` (e.g. "Follow up", "Prepare for interview") — the date
   * alone doesn't say. "" means not set, same tri-state convention as `notes`/`level`. */
  nextAction: string;
  notes: string;
  stack: string[];
  created?: string;
  favorite: boolean;
  coverLetter: string;
  coverLetterDetails: string;
}

/** GET /vacancies/:id/similar — see server/src/modules/vacancies/vacancies.repo.ts#findSimilarVacancies. */
export interface SimilarVacancy extends Vacancy {
  /** Cosine similarity to the reference vacancy's embedding, roughly in [0,1]. */
  similarity: number;
}

export interface Profile {
  skills: string[];
  cvText: string;
  domain?: string;
  track?: Track;
}

export interface Resource {
  t: string;
  u: string;
  ai?: boolean;
}

/** GET /onboarding/state. The two `has*` flags exist for the sidebar's "this section has nothing
 * in it yet" dimming (App.tsx) — they ride on this endpoint because the shell already fetches it
 * on every route, so the dimming costs no extra request and can't disagree with itself between
 * pages the way a per-page list query would. */
export interface OnboardingState {
  welcomeSeen: boolean;
  hasVacancies: boolean;
  hasNetwork: boolean;
}

/** Mirrors FOCUS_ACTION_KINDS in server/src/modules/analytics/analytics.service.ts — a closed set
 * of app areas, deliberately not URLs (the server doesn't know the client's routes). Mapped to an
 * actual destination by features/dashboard/focus-destination.ts. */
export type FocusActionKind = "vacancies" | "interviews" | "skills" | "cards" | "contacts" | "cv";

/** Mirrors FOCUS_ACTION_CODES on the server. Present only on the OFFLINE heuristic fallback,
 * whose `title`/`why` are hardcoded English — the dashboard translates this instead (see
 * dashboard.json's `focusWeek.heuristic`), which also gets correct uk one/few/many plurals from
 * i18next for free. An LLM-authored action has no `code`; its prose is already localized. */
export type FocusActionCode = "overdue" | "interviews" | "gap" | "moreVacancies" | "dueCards" | "stale";

export interface FocusAction {
  title: string;
  why: string;
  /** Absent when the model couldn't classify the action — it then renders as plain text. */
  kind?: FocusActionKind;
  code?: FocusActionCode;
  params?: Record<string, string | number>;
}

export interface FocusWeek {
  offline?: boolean;
  actions: FocusAction[];
}

export interface StageConversion {
  from: string;
  to: string;
  /** % of vacancies that reached `from` which then also reached `to`. null — none has reached `from` yet. */
  rate: number | null;
}

export interface StageDuration {
  status: string;
  /** Average number of days between entering this status and the next status change. */
  avgDays: number;
  count: number;
}

export interface Analytics {
  /** Current distribution of vacancies by status (a "where things stand now" snapshot). */
  funnel: Record<string, number>;
  /** How many vacancies EVER had each status — an honest funnel of stage progression. */
  funnelReached: Record<string, number>;
  byDate: Record<string, number>;
  demand: Record<string, number>;
  /** Conversion between adjacent funnel stages (what fraction gets stuck right here). */
  conversion: StageConversion[];
  /** Average "wait" time in each status, longest first — where steps actually get stuck. */
  stageDurations: StageDuration[];
}

// Advisory only (see server/src/modules/jobs/job-dedupe.ts) — a near-duplicate by company+title
// SimHash similarity to something already tracked; the import still adds it, this is just a
// heads-up the UI can surface, never a block.
export interface PossibleDuplicate {
  index: number;
  company: string;
  position: string;
  of: { id: number; company: string; position: string };
}

export interface JsonVacancyImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: { index: number; message: string }[];
  possibleDuplicates: PossibleDuplicate[];
}

export interface LearnGap {
  tech: string;
  count: number;
  learn: string[];
  resources: Resource[];
  drills: { q: string; lvl: string }[];
  cards: { q: string }[];
  focus?: string | null;
}

export interface LearnData {
  gaps: LearnGap[];
  strengths: { tech: string; count: number }[];
  totalVacancies: number;
}

export interface RoadmapNode {
  tech: string;
  group: string;
  demand: number;
  known: boolean;
  status: RoadmapStatus;
  learn: string[];
  resources: Resource[];
  drillsTotal: number;
  drillsSolved: number;
  /** Effective 0..100 skill level: the manual override when set, otherwise levelAuto. */
  level: number;
  levelAuto: number;
  levelManual: number | null;
  levelParts: { status: number; drills: number | null; recall: number | null };
  cardsTotal: number;
  cardsGraded: number;
  /** Drill/card category the level's drills/recall components are measured on, if any. */
  practiceCat: string | null;
  /** True when practiceCat is shared by more than one technology — the drills/recall components
   * are then identical across those techs, so the level reads as track-wide, not tech-specific. */
  practiceShared: boolean;
}

export interface MockEvaluation {
  offline?: boolean;
  score: number | null;
  verdict: string;
  good?: string[];
  missed?: string[];
  tip?: string;
}

export interface InterviewReview {
  score: number;
  verdict: string;
  good: string[];
  missed: string[];
  tip: string;
}

export interface InterviewTurnResult {
  offline?: boolean;
  /** true only for a transient failure — the client should keep the transcript/answer and retry
   * the exact same call, not restart the interview. */
  retryable?: boolean;
  done: boolean;
  question: string;
  review: InterviewReview | null;
  turnNumber: number;
  maxTurns: number;
}

export interface RoadmapGroup {
  group: string;
  nodes: RoadmapNode[];
}

export interface RoadmapData {
  groups: RoadmapGroup[];
  progress: { done: number; learning: number; total: number };
}

export interface KnowledgeData {
  tech: string;
  focus: string | null;
  learn: string[];
  resources: Resource[];
  source: "ai" | "static";
  cached?: boolean;
}

export interface StudyCard {
  id: string;
  cat: string;
  q: string;
  a: string;
}

export interface Drill {
  id: string;
  cat: string;
  lvl: string;
  q: string;
  sol: string;
  exp: string;
  generated?: boolean;
  tech?: string;
}

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string;
}

export interface StudyState {
  due: StudyCard[];
  total: number;
  learned: number;
  streak: StreakState;
  drills: Drill[];
  drillProgress: Record<string, string>;
}

/** GET /study/archive — snapshot of each solved drill (q/sol/exp), newest first. */
export interface DrillArchiveEntry {
  id: string;
  drillId: string;
  cat: string;
  lvl: string;
  q: string;
  sol: string;
  exp: string;
  generated?: boolean;
  tech?: string;
  solvedAt: string;
}

export interface ProjectDoD {
  id: string;
  text: string;
}

export interface Project {
  id: string;
  name: string;
  subtitle: string;
  phase: string;
  tech: string[];
  goal: string;
  dod: ProjectDoD[];
  /** True for an AI-generated idea tailored to this candidate's own skill gaps, as opposed to the
   * static fallback ladder shown offline or once every gap is already closed. */
  personalized?: boolean;
}

export interface ProjectsData {
  projects: Project[];
  progress: Record<string, boolean>;
  /** True when at least one project above was actually AI-personalized (not the static ladder). */
  personalized?: boolean;
  /** True while the server's background personalization job (see server's projects-job.ts) is
   * still running — `projects` above is the static ladder, or a previous run's sticky result,
   * until it flips to false. useProjects() re-polls while this is true (see
   * shared/queries/projects.ts). */
  generating?: boolean;
}

export interface PlanDay {
  id: string;
  day: number;
  theory: string;
  practice: string;
  warmup?: string;
}

export interface PlanPhase {
  id: string;
  title: string;
  range: string;
  note?: string;
  days: PlanDay[];
}

export interface Plan21Data {
  phases: PlanPhase[];
  progress: Record<string, boolean>;
}

export interface Company {
  id: number;
  name: string;
  notes: string;
  questions: string[];
  /** Bare host (e.g. "acme.com"), or "" if unset — server-side `parseCompanyInput` normalizes a
   * bare domain or full URL, so the client sends whatever the user typed as-is. */
  website: string;
}

// `relevance`/`matchedTechs`/`gapTechs` are computed server-side (resources.service.ts) against
// the caller's own profile skills + vacancy-derived demand — the same static guide, ranked/
// flagged per user. `gapTechs.length > 0` is what the UI treats as "relevant to you".
interface Scored {
  relevance: number;
  matchedTechs: string[];
  gapTechs: string[];
}
export interface ResourcesData {
  bestPractices: ({ group: string; links: Resource[] } & Scored)[];
  platforms: ({ group: string; name: string; url: string; note: string } & Scored)[];
  cheat: ({ title: string; items: string[] } & Scored)[];
  checklist: { text: string; relevant: boolean }[];
  focus: string;
  /** true when `focus` is the user's own text rather than a generated one — see
   * resources.service.ts's setFocusOverride. */
  focusCustom: boolean;
  /** Top gap techs offered as one-click suggestions while editing the focus. */
  focusSuggestions: string[];
}

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  // Fired (in addition to the toast's own dismiss-on-click) when set — e.g. "Vacancy added" jumps
  // to the vacancies tab instead of just confirming and vanishing.
  onAction?: () => void;
}

export type FetchAllJobStatus = "running" | "done" | "error";

export interface FetchAllItemResult {
  id: number;
  company: string;
  techs?: string[];
  level?: string;
  /** Already-known skills this vacancy needs (overlaps the candidate's profile). */
  match?: string[];
  /** Skills this vacancy needs that the candidate's profile doesn't have yet. */
  gap?: string[];
  fit?: Fit;
  error?: string;
}

/** GET/POST /vacancies/fetch-all(/status) — see server/src/modules/vacancies/fetch-all-job.ts.
 * The batch loop runs as a background job (fire-and-forget); this is polled for live progress
 * rather than awaited synchronously. */
export interface FetchAllJobState {
  status: FetchAllJobStatus;
  total: number;
  processed: number;
  results: FetchAllItemResult[];
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface AnalyzeResult {
  techs: string[];
  level: string;
  gap: string[];
  match: string[];
  summary: string | null;
  fit: Fit;
  /** Cosine similarity of CV↔vacancy embeddings, [0,1]. null — embeddings unavailable (non-OpenAI/no CV). */
  semanticFit: number | null;
}

/** POST /vacancies/fetch-details — best-effort everything-we-can-read for one vacancy link,
 * powering the "+ Add vacancy" modal's "autofill from link" action and the detail modal's "refresh
 * from link". Every field is a best-effort guess and may come back empty/"" — never an error, see
 * fetchVacancyDetails on the server. The `company*` fields describe the EMPLOYER (for creating and
 * linking a `companies` row) and are only populated when an LLM key is configured. */
export interface VacancyDetails {
  company: string;
  position: string;
  level: string;
  salary: string;
  stack: string[];
  fit: Fit;
  notes: string;
  companyNotes: string;
  companyWebsite: string;
  companyQuestions: string[];
}

export interface CvAnalysis {
  demand: Record<string, number>;
  gaps: [string, number][];
  strengths: [string, number][];
  advice: string;
}

export interface CvMatch {
  offline?: boolean;
  score: number;
  verdict: string;
  matched: string[];
  missing: string[];
  suggestions: { title: string; fix: string }[];
  tailoredSummary: string;
  semanticFit: number | null;
}

export interface CvMetric {
  value: string;
  label: string;
}

export interface CvExperience {
  role: string;
  company: string;
  period: string;
  /** One line of context under the job head — what the product or team actually was. Optional:
   * every entry saved before this existed simply has no note, and renders exactly as it did. */
  note?: string;
  bullets: string[];
  /** Headline figures shown as a small strip above the bullets (max 4 — one printed row). */
  metrics?: CvMetric[];
}

/** Categorized skills ("Frontend" → TypeScript, Vue, …), rendered by `skillsStyle: "grouped"`.
 * Additive to the flat `skills` array, which stays canonical for everything non-visual — see the
 * server's CvSkillGroupsSchema for why the two are not merged. */
export interface CvSkillGroup {
  name: string;
  skills: string[];
}

export type CvSection =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "languages"
  | "awards"
  | "publications"
  | "volunteer"
  | "references";

export interface CvTheme {
  template: "classic" | "compact" | "academic" | "twocol" | "minimal" | "sidebar" | "timeline" | "technical";
  accent: string;
  font: "sans" | "serif";
  scale: number;
  order?: CvSection[];
  showPhoto?: boolean;
  photoShape?: "circle" | "square";
  photoPos?: "left" | "right";
  /** How the Skills section renders. "auto" (the default, and what every doc saved before this
   * existed parses as) keeps the per-template behavior: an inline "A · B · C" line on the
   * text-dense templates, chips everywhere else. */
  skillsStyle?: "auto" | "chips" | "inline" | "list" | "grouped";
  /** Chip looks — only meaningful while the skills render AS chips. */
  skillChipShape?: "pill" | "rounded" | "square";
  skillChipFill?: "tint" | "outline" | "solid";
  /** Typeface for the small meta text (contact, section labels, dates, metric figures). "auto"
   * defers to the template, which means a monospace only on `technical`. */
  metaFont?: "auto" | "body" | "mono";
  /** How a contact link prints. "label" (the default, and what every doc saved before this existed
   * parses as) shows only the anchor text — which means the address survives in the exported PDF
   * ONLY as a link annotation, invisible to a parser reading the text layer. "url" prints the
   * shortened address as the visible text; "both" prints "Label: url". */
  linkStyle?: "label" | "url" | "both";
  /** Opt-in `**bold**` / `` `code` `` inside bullets and the summary. Off by default so a CV
   * containing literal asterisks keeps printing them. */
  richText?: boolean;
}

export interface CvPreset {
  name: string;
  theme: CvTheme;
}

export interface CvLanguage {
  name: string;
  level: string;
}

export interface CvEducationEntry {
  school: string;
  degree: string;
  period: string;
}

export interface CvProjectEntry {
  title: string;
  description: string;
  tech: string[];
  link: string;
}

export interface CvCertificationEntry {
  name: string;
  issuer: string;
  date: string;
}

export interface CvAwardEntry {
  title: string;
  issuer: string;
  date: string;
}

export interface CvPublicationEntry {
  title: string;
  publisher: string;
  date: string;
  url: string;
}

/** Lighter than CvExperience (no `bullets` array) — a single role/org/period plus one blurb. */
export interface CvVolunteerEntry {
  role: string;
  organization: string;
  period: string;
  description: string;
}

export interface CvReferenceEntry {
  name: string;
  relation: string;
  contact: string;
}

export interface CvContactLink {
  label: string;
  url: string;
}

export interface CvDoc {
  name: string;
  title: string;
  contact: string;
  /** Own field rather than more text inside `contact`, so the renderer can format it (and a
   * `tel:` href) instead of printing whatever was typed. Optional for the same reason as `links`:
   * every document written before it existed keeps its phone inside `contact`, and splitting that
   * back out automatically would be guesswork. */
  phone?: string;
  /** Accepts `@name`, `name`, `t.me/name` or a full URL — normalized for display and href by
   * telegramContact() (cv-doc-utils.ts). Separate from `links` because a handle isn't a URL, and
   * typing one into a link row produced a broken `https://@name` href. */
  telegram?: string;
  /** Where the candidate is, and whether they're open to remote ("Kyiv, Ukraine · open to
   * remote"). Its own field because it's the one contact detail that gets FILTERED on — an ATS
   * geo-filter and a recruiter's first question both need it, and a résumé that never states it
   * drops out of location-scoped searches entirely. */
  location?: string;
  /** Structured, separately-editable links (LinkedIn/GitHub/portfolio/etc.) — additive alongside
   * `contact` (which stays freeform for email/location), not a replacement for it: an
   * existing account's `contact` may already have URLs typed into it as plain text, and there's
   * no reliable way to split that back apart, so this only ever grows going forward. */
  links?: CvContactLink[];
  summary: string;
  photo?: string;
  skills: string[];
  skillGroups?: CvSkillGroup[];
  experience: CvExperience[];
  education: CvEducationEntry[];
  projects: CvProjectEntry[];
  certifications?: CvCertificationEntry[];
  languages?: CvLanguage[];
  awards?: CvAwardEntry[];
  publications?: CvPublicationEntry[];
  volunteer?: CvVolunteerEntry[];
  references?: CvReferenceEntry[];
  theme?: CvTheme;
}

/** One tab in the CV Builder's profile strip (e.g. "Backend", "Management") — up to 5 per
 * account. Summary shape only (no doc/presets) for the list endpoint; see CvProfileFull below for
 * what a single profile's own doc/generate/etc. routes return. */
export interface CvProfile {
  id: number;
  name: string;
  position: number;
  updatedAt: string;
}

export interface CvProfileFull extends CvProfile {
  doc: CvDoc;
  presets: CvPreset[];
}

/** Result of adapting the CV Builder doc to one specific vacancy (POST /cv/tailor) — the
 * candidate's own skills/bullets reordered by relevance (nothing invented/dropped) plus the
 * existing LLM gap analysis (`match`, same shape as CvMatch) for the report tab. */
export interface CvTailorResult {
  doc: CvDoc;
  match: CvMatch;
  reordered: { skills: number; bullets: number };
}

/** Response of POST /cv/audit — the judgement half of the line-by-line audit. The findings are
 * typed as `AuditFinding` in features/cv/builder/cv-audit.ts (where the rule engine that produces
 * the other half lives); this stays structurally compatible with it. */
export interface CvAuditResult {
  findings: {
    id: string;
    target: Record<string, unknown> & { kind: string };
    verdict: "rewrite" | "delete" | "merge" | "add" | "keep";
    severity: "high" | "medium" | "low";
    source: "ai";
    title: string;
    reason: string;
    before?: string;
    after?: string;
    mergeWith?: number;
  }[];
  positioning: { detectedRole: string; suggestedTitle: string; rationale: string } | null;
  /** Whole-document judgements that no line-level finding carries. These used to come from a
   * separate "CV review" call over the same résumé — a second cost, and a second opinion that
   * could contradict this one on the same line. */
  score: number | null;
  summary: string;
  strengths: string[];
  keywords: string[];
  offline: boolean;
}

export type CvAuditJobStatus = "running" | "done" | "error";
export type CvAuditStep = "preparing" | "generating_feedback" | "finalizing";

export interface CvAuditJobState {
  status: CvAuditJobStatus;
  step: CvAuditStep | null;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  result?: CvAuditResult;
}

export interface JobResult {
  company: string;
  position: string;
  url: string;
  location: string;
  tags: string[];
  source: string;
  matchCount: number;
  /** ISO instant, or null when the source didn't provide a usable posting date. */
  postedAt: string | null;
}

export interface AdminOverview {
  totalUsers: number;
  totalVacancies: number;
  days: number;
  llmCostUsd: number;
  llmCalls: number;
  logsDashboardUrl: string | null;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  createdAt: string;
  vacancyCount: number;
  llmCallsRecent: number;
  plan: string;
  subStatus: string;
  llmCostRecentUsd: number;
  blockedCallsRecent: number;
}

export interface AdminUsersResult {
  users: AdminUserRow[];
  total: number;
}

export interface AdminLlmUsageSummary {
  days: number;
  totalCalls: number;
  totalCostUsd: number;
  byFeature: { feature: string; calls: number; totalTokens: number; costUsd: number }[];
  byDay: { day: string; calls: number; costUsd: number }[];
  byModel: { model: string | null; calls: number; costUsd: number }[];
  byTier: { tier: string | null; calls: number; costUsd: number }[];
  byOutcome: { outcome: string; calls: number; costUsd: number }[];
}

export interface AdminProductEventsSummary {
  days: number;
  byName: { name: string; count: number }[];
  searchesByDay: { day: string; count: number }[];
  topSearchQueries: { query: string; count: number }[];
}

export interface AdminBillingSummary {
  days: number;
  planCounts: { plan: string; status: string; count: number }[];
  estimatedMrrUsd: number;
  quotaExceededCount: number;
  budgetExceededCount: number;
}

export interface JobSearchResult {
  query: string;
  count: number;
  jobs: JobResult[];
  offline?: boolean;
  /** true when there was no query, no profile skills/domain, and no tracked vacancies to derive
   * one from — no external aggregator was queried at all (see jobs.routes.ts). Distinct from
   * offline: this means "nothing to search for," not "the search ran and found nothing." */
  needsQuery?: boolean;
}

export const CALENDAR_EVENT_TYPES = ["interview", "call", "deadline", "reminder", "other"] as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export interface CalendarEvent {
  id: number;
  title: string;
  notes: string;
  /** ISO instant. */
  startAt: string;
  /** ISO instant, or null — no end time set. */
  endAt: string | null;
  type: CalendarEventType;
  /** Video-call link (Meet/Zoom/Teams/…), or "" — the server guarantees http(s), so it's safe to
   * put straight into an href. */
  meetingUrl: string;
  /** Linked vacancy, or null — a plain personal event. */
  vacancyId: number | null;
  /** Linked networking contact, or null — e.g. the recruiter this call is with. */
  contactId: number | null;
}

export interface CalendarEventInput {
  title: string;
  notes: string;
  startAt: string;
  endAt: string | null;
  type: CalendarEventType;
  meetingUrl: string;
  vacancyId: number | null;
  contactId: number | null;
}

/** A vacancy's own `next` (next-step) date, surfaced read-only in the combined calendar view —
 * clicking one navigates to that vacancy, it's never edited from the calendar itself. */
export interface CalendarVacancyStep {
  vacancyId: number;
  company: string;
  position: string;
  date: string;
}

/** A day with N SRS flashcards due, surfaced read-only — clicking navigates to Study. */
export interface CalendarSrsDueDay {
  date: string;
  count: number;
}

export interface CombinedCalendar {
  events: CalendarEvent[];
  vacancyNextSteps: CalendarVacancyStep[];
  srsDue: CalendarSrsDueDay[];
}

export const JOB_SEARCH_REGIONS = ["all", "ua", "remote"] as const;
export type JobSearchRegion = (typeof JOB_SEARCH_REGIONS)[number];

export interface SavedSearch {
  id: number;
  query: string;
  region: JobSearchRegion;
  label: string | null;
  lastNotifiedAt: string | null;
}

export interface SavedSearchInput {
  query: string;
  region: JobSearchRegion;
  label: string;
}

export interface Contact {
  id: number;
  name: string;
  role: string;
  companyId: number | null;
  /** Linked vacancy (e.g. the recruiter/hiring manager for this application), or null. */
  vacancyId: number | null;
  email: string;
  linkedinUrl: string;
  notes: string;
  /** Where this contact came from: "posting", "signature", "manual", or "" for rows created before
   * the field existed. Provenance, not decoration — it's what makes "where did you get my address"
   * answerable. */
  source: string;
  /** ISO date (YYYY-MM-DD), or "" — not set. */
  lastContactAt: string;
}

export interface ContactInput {
  name: string;
  role: string;
  companyId: number | null;
  vacancyId: number | null;
  email: string;
  linkedinUrl: string;
  notes: string;
  /** Optional on the wire: the server stores "" for anything it doesn't recognize, so a form that
   * doesn't set it simply records an unknown origin rather than a wrong one. */
  source?: string;
  lastContactAt: string;
}

/** POST /contacts/site-scan — addresses a company publishes on its own careers/contact pages.
 * Same exact-only rule as PostingContact: every address was literally on the page. */
export interface SiteContactsResult {
  contacts: { email: string; page: string }[];
  /** Paths actually read — excludes anything robots.txt disallowed or that failed to load. */
  pagesRead: string[];
  /** True when robots.txt asked automation to stay out of every page we'd have looked at. */
  blockedByRobots: boolean;
}

/** A contact the posting itself states — see server modules/contacts/enrichment/posting-contacts.ts.
 * Nothing here is inferred: every `value` appears verbatim in the source text, which is why this
 * has no confidence/status field the way EnrichedPerson does. */
export type PostingContactChannel = "email" | "telegram" | "linkedin";

export interface PostingContact {
  /** "" when the text gives an address with no name attached. */
  name: string;
  title: string;
  channel: PostingContactChannel;
  value: string;
  /** Email rows only: whether the domain accepts mail at all. Only "no-mail" is worth surfacing —
   * "unknown" covers every non-email row and every lookup that couldn't answer. */
  mailDomain: "accepts-mail" | "no-mail" | "unknown";
}

export interface CvShare {
  slug: string;
  enabled: boolean;
}

export interface DigestPreferences {
  enabled: boolean;
  /** ISO instant of the last digest actually sent, or null — none yet. */
  lastSentAt: string | null;
}

export type PlanId = "free" | "pro" | "team";

/** Mirrors server/src/modules/billing/billing.service.ts#BillingState. */
export interface BillingState {
  plan: PlanId;
  /** Stripe's status verbatim (or "inactive") — display only, see the server's entitlementsFor(). */
  status: string;
  /** false when STRIPE_* is unconfigured server-side — the whole billing UI hides in that case. */
  billingEnabled: boolean;
  /** null = no call-count ceiling (Pro/Team). */
  aiCallsPerMonth: number | null;
  aiCallsUsed: number;
  /** ISO instant the count resets, or null when aiCallsPerMonth is null. */
  quotaResetsAt: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

export type CheckoutPlan = "pro";

/** Mirrors server/src/modules/vacancies/vacancies.routes.ts's GET /vacancies/apply-progress. */
export interface ApplyProgress {
  streak: StreakState;
  weeklyGoal: number;
  appliedThisWeek: number;
}

/** Mirrors server/src/modules/referrals/referrals.routes.ts's GET /referrals/me. `code` is the
 * referrer's own userId — see referrals.service.ts's top comment for why there's no separate
 * code concept. */
export interface ReferralState {
  code: string;
  pending: number;
  qualified: number;
  bonusCallsPerMonth: number;
}

/** Persisted wire value — never translated directly, see shared/fit-tone.ts's Fit for the same
 * convention. The Account page maps each to a display label via a small lookup instead. */
export type ApiTokenScope = "read" | "read_write";

/** GET /mcp/tokens — a personal API token connecting an external MCP client (e.g. Claude Desktop)
 * to the account. Already-revoked tokens are excluded server-side, so every row here is active.
 * The raw secret itself is never returned by this endpoint — see ApiTokenCreated below, the only
 * response that ever carries it. */
export interface ApiToken {
  id: number;
  label: string;
  scope: ApiTokenScope;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface ApiTokenInput {
  label: string;
  scope: ApiTokenScope;
  expiresAt?: string;
}

/** POST /mcp/tokens response. `token` is the raw secret value, shown/copyable exactly once — it
 * can never be fetched again afterwards (GET /mcp/tokens only ever returns the metadata above). */
export interface ApiTokenCreated {
  id: number;
  token: string;
}

/** Mirrors server/src/modules/notifications/notifications.routes.ts's GET /notifications/settings.
 *
 * `prefs` is SPARSE — only explicit opt-outs are stored, so a kind missing from it is ON (see
 * server/src/shared/notifications.ts). `kinds` comes from the server rather than being a client-side
 * constant so the two can't drift; the UI renders a toggle per entry and translates the LABEL only,
 * never the kind itself, which is a persisted wire value. */
export interface NotificationSettings {
  prefs: Record<string, boolean>;
  timezone: string | null;
  kinds: string[];
}

export type DesignNodeKind =
  "client" | "loadBalancer" | "service" | "database" | "cache" | "queue" | "cdn" | "storage" | "thirdParty" | "generic";

export interface DesignNode {
  id: string;
  kind: DesignNodeKind;
  label: string;
  x: number;
  y: number;
}

export interface DesignEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

// Freeform drawing (pen/shapes/arrows/text) layered on top of the structured node/edge graph —
// mirrors server/src/modules/design/design.service.ts's DesignAnnotation. Purely decorative: the
// AI grading prompt never reads these (see that file's own comment), so they're optional here too.
export type DesignAnnotationKind = "freehand" | "rectangle" | "ellipse" | "arrow" | "text";
interface DesignAnnotationBase {
  id: string;
  color: string;
  /** Clockwise degrees about the annotation's own bounding-box center; absent means unrotated.
   * Arrows never carry one — they're reshaped by dragging their two endpoints instead, and a
   * rotation would fight the node binding below, which writes endpoints in world coordinates. */
  rotation?: number;
}
export interface DesignFreehandAnnotation extends DesignAnnotationBase {
  kind: "freehand";
  points: { x: number; y: number }[];
}
export interface DesignRectangleAnnotation extends DesignAnnotationBase {
  kind: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DesignEllipseAnnotation extends DesignAnnotationBase {
  kind: "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DesignArrowAnnotation extends DesignAnnotationBase {
  kind: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Ids of the DesignNodes this arrow's start/end are stuck to, set by dropping that endpoint on a
   * node. The endpoint coordinates above stay the source of truth for rendering — the binding just
   * makes the canvas recompute them whenever the bound node moves or resizes, so the arrow follows
   * (see design-annotations.ts's applyArrowBindings). Still decorative: unlike a DesignEdge, a
   * bound arrow is never read as a structural connection by the grader. */
  startNodeId?: string;
  endNodeId?: string;
}
export interface DesignTextAnnotation extends DesignAnnotationBase {
  kind: "text";
  x: number;
  y: number;
  text: string;
}
export type DesignAnnotation =
  DesignFreehandAnnotation | DesignRectangleAnnotation | DesignEllipseAnnotation | DesignArrowAnnotation | DesignTextAnnotation;

export interface DesignDiagram {
  nodes: DesignNode[];
  edges: DesignEdge[];
  annotations?: DesignAnnotation[];
}

export interface DesignTask {
  title: string;
  scenario: string;
  requirements: string[];
  constraints: string[];
  difficulty: "easy" | "medium" | "hard";
}

export interface DesignCriterion {
  title: string;
  met: boolean;
  note: string;
}

// A suggested reference solution — kind/label only, no x/y (see shared/design-layout.ts's
// layoutReference, which auto-positions these deterministically by kind). Edges reference nodes
// by label text, not index. Only populated by a real AI grade, never the offline heuristic.
export interface DesignReferenceNode {
  kind: DesignNodeKind;
  label: string;
}
export interface DesignReferenceEdge {
  from: string;
  to: string;
}

export interface DesignGrade {
  offline?: boolean;
  score: number;
  summary: string;
  criteria: DesignCriterion[];
  strengths: string[];
  missed: string[];
  tip: string;
  referenceNodes?: DesignReferenceNode[];
  referenceEdges?: DesignReferenceEdge[];
}

/** GET /design/current — the single in-progress/most-recent exercise, so a reload doesn't lose
 * the diagram (unlike the stateless mock interview, building a diagram is real effort). null —
 * nothing saved yet. */
export interface DesignExercise {
  task: DesignTask;
  diagram: DesignDiagram;
  grade: DesignGrade | null;
}

/** GET /design/history — lightweight, score-only log of past graded exercises (no diagram),
 * newest first, capped server-side. */
export interface DesignHistoryEntry {
  id: string;
  title: string;
  difficulty: DesignTask["difficulty"];
  score: number;
  offline: boolean;
  gradedAt: string;
}

/** GET /design/archive — full task/diagram/grade snapshot of each graded exercise, newest first,
 * capped server-side. Unlike DesignHistoryEntry (score-only, feeds the progression indicator),
 * this is a fully reviewable "task + solution" record — every grade is its own entry. */
export interface DesignArchiveEntry {
  id: string;
  task: DesignTask;
  diagram: DesignDiagram;
  grade: DesignGrade;
  gradedAt: string;
}

export interface DesignDefenseReview {
  score: number;
  verdict: string;
  good: string[];
  missed: string[];
  tip: string;
}

// POST /design/defense — same stateless "client resends the whole transcript" contract and result
// shape as InterviewTurnResult (see server/src/modules/design/design.service.ts's runDefenseTurn
// doc comment for why this is a sibling to the mock interview, not a reuse of it).
export interface DesignDefenseTurnResult {
  offline?: boolean;
  retryable?: boolean;
  done: boolean;
  question: string;
  review: DesignDefenseReview | null;
  turnNumber: number;
  maxTurns: number;
}

/** Stable identifiers, not display text — linkedin-optimizer-card.tsx maps each to its own i18n
 * key, the same way fit-tone.ts handles Fit. Mirrors linkedin-market.ts's LinkedInAuditCheckId. */
export type LinkedInAuditCheckId =
  | "headlinePresent"
  | "headlineWithinLimit"
  | "headlineHasKeyword"
  | "aboutPresent"
  | "aboutLongEnough"
  | "aboutWithinLimit"
  | "aboutHasKeywords";

export interface LinkedInAuditCheck {
  id: LinkedInAuditCheckId;
  ok: boolean;
}

export interface LinkedInAudit {
  score: number;
  checks: LinkedInAuditCheck[];
}

/** The last generated/pasted profile, persisted server-side (a `user_kv` blob) so the card comes
 * back filled in. The audit isn't part of it — it's derived from the tracker, which moves. */
export interface SavedLinkedInProfile {
  current: { headline: string; about: string };
  headline: string;
  about: string;
  savedAt: string;
}

export interface LinkedInOptimizeResult {
  headline: string;
  about: string;
  /** The candidate's skills ordered for LinkedIn's Skills section by tracked-vacancy demand. */
  skills: string[];
  /** Job titles for LinkedIn's "Open to work", taken from the vacancies actually being tracked. */
  targetRoles: string[];
  /** Present only when the user pasted the profile they already have. */
  audit: LinkedInAudit | null;
  /** False when the tracker is empty — `skills`/`targetRoles` are then just profile data. */
  marketAware: boolean;
  offline: boolean;
}

export interface OutreachResult {
  message: string;
  offline?: boolean;
}
