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
  url: string;
  status: string;
  fit: Fit;
  applied: string;
  next: string;
  notes: string;
  stack: string[];
  created?: string;
}

export interface Profile {
  skills: string[];
  cvText: string;
  domain?: string;
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

export interface RadarPoint {
  tech: string;
  demand: number;
  you: number;
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
  radar: RadarPoint[];
  /** Conversion between adjacent funnel stages (what fraction gets stuck right here). */
  conversion: StageConversion[];
  /** Average "wait" time in each status, longest first — where steps actually get stuck. */
  stageDurations: StageDuration[];
}

export interface JsonVacancyImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: { index: number; message: string }[];
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
}

export interface MockEvaluation {
  offline?: boolean;
  score: number | null;
  verdict: string;
  good?: string[];
  missed?: string[];
  tip?: string;
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

export interface StudyState {
  due: StudyCard[];
  total: number;
  learned: number;
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
}

export interface ProjectsData {
  projects: Project[];
  progress: Record<string, boolean>;
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

export interface ResourcesData {
  bestPractices: { group: string; links: Resource[] }[];
  platforms: { group: string; name: string; url: string; note: string }[];
  cheat: { title: string; items: string[] }[];
  checklist: string[];
}

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export interface FetchAllResult {
  processed: number;
  results: { id: number; company: string; techs?: string[]; fit?: string; error?: string }[];
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

export interface CvMatch {
  offline?: boolean;
  score: number;
  verdict: string;
  matched: string[];
  missing: string[];
  suggestions: { title: string; fix: string }[];
  tailoredSummary: string;
}

export interface CvExperience {
  role: string;
  company: string;
  period: string;
  bullets: string[];
}

export type CvSection = "summary" | "skills" | "experience" | "projects" | "education" | "languages";

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

export interface CvDoc {
  name: string;
  title: string;
  contact: string;
  summary: string;
  photo?: string;
  skills: string[];
  experience: CvExperience[];
  education: string[];
  projects: string[];
  languages?: CvLanguage[];
  theme?: CvTheme;
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
}

export interface JobSearchResult {
  query: string;
  count: number;
  jobs: JobResult[];
  offline?: boolean;
}
