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
] as const;
export type VacancyStatus = (typeof STATUSES)[number];

export interface Vacancy {
  id: number;
  company: string;
  position: string;
  level: string;
  salary: string;
  url: string;
  status: string;
  fit: Fit;
  applied: string;
  next: string;
  notes: string;
  stack: string[];
  created?: string;
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

export interface FocusAction {
  title: string;
  why: string;
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
}

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
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

export interface CvAnalysis {
  demand: Record<string, number>;
  gaps: [string, number][];
  strengths: [string, number][];
  advice: string;
}

export interface CvReview {
  offline?: boolean;
  score: number | null;
  summary: string;
  strengths: string[];
  issues: { title: string; fix: string }[];
  keywords: string[];
  rewrites: { before: string; after: string }[];
}

export type CvReviewJobStatus = "running" | "done" | "error";
export type CvReviewStep = "preparing" | "generating_feedback" | "finalizing";

/** POST /cv/review/start + GET /cv/review/status — the backgrounded version of the CV Builder's
 * "AI Assistant" review (see server/src/modules/cv/cv-review-job.ts). */
export interface CvReviewJobState {
  status: CvReviewJobStatus;
  step: CvReviewStep | null;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  result?: CvReview;
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

export interface CvExperience {
  role: string;
  company: string;
  period: string;
  bullets: string[];
}

export type CvSection = "summary" | "skills" | "experience" | "projects" | "education" | "certifications" | "languages";

export interface CvTheme {
  template: "classic" | "compact" | "academic" | "twocol" | "minimal" | "sidebar" | "timeline";
  accent: string;
  font: "sans" | "serif";
  scale: number;
  order?: CvSection[];
  showPhoto?: boolean;
  photoShape?: "circle" | "square";
  photoPos?: "left" | "right";
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

export interface CvContactLink {
  label: string;
  url: string;
}

export interface CvDoc {
  name: string;
  title: string;
  contact: string;
  /** Structured, separately-editable links (LinkedIn/GitHub/portfolio/etc.) — additive alongside
   * `contact` (which stays freeform for email/phone/location), not a replacement for it: an
   * existing account's `contact` may already have URLs typed into it as plain text, and there's
   * no reliable way to split that back apart, so this only ever grows going forward. */
  links?: CvContactLink[];
  summary: string;
  photo?: string;
  skills: string[];
  experience: CvExperience[];
  education: CvEducationEntry[];
  projects: CvProjectEntry[];
  certifications?: CvCertificationEntry[];
  languages?: CvLanguage[];
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
  /** Linked vacancy, or null — a plain personal event. */
  vacancyId: number | null;
}

export interface CalendarEventInput {
  title: string;
  notes: string;
  startAt: string;
  endAt: string | null;
  type: CalendarEventType;
  vacancyId: number | null;
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
  lastContactAt: string;
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

export interface LinkedInOptimizeResult {
  headline: string;
  about: string;
  offline: boolean;
}

export interface OutreachResult {
  message: string;
  offline?: boolean;
}
