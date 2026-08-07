// Pure, DB-free analytics/focus computation — split out of analytics.routes.ts so the funnel
// math and the heuristic "focus of the week" fallback are unit-testable without an Express
// request/response and a live DB (same reasoning as shared/demand.ts's computeDemand()).
import { topGapTechs } from "../../shared/demand.js";

// How many days of silence after applying counts as a "gone quiet" vacancy worth nudging the recruiter about.
export const STALE_APPLICATION_DAYS = 14;
// Statuses where the candidate is genuinely waiting on a response from the other side (as
// opposed to "Want to apply" — not yet submitted, and the terminal "Offer"/"Rejected"/"Paused" —
// the waiting has deliberately already ended).
export const WAITING_STATUSES = ["Applied", "Screening", "Tech interview", "Take-home task", "Final"];

// "Rejected" is deliberately NOT included in FUNNEL_PROGRESSION_ORDER: it's a terminal "exit"
// from almost any stage, not the next STEP of the funnel — including it would give a false
// signal like "Final→Rejected conversion 40%", even though Rejected could have happened from
// earlier stages too.
export const FUNNEL_ORDER = ["Want to apply", "Applied", "Screening", "Tech interview", "Take-home task", "Final", "Offer", "Rejected"];
export const FUNNEL_PROGRESSION_ORDER = FUNNEL_ORDER.filter((s) => s !== "Rejected");

export interface VacancyStatusRow {
  status: string;
  created: string;
  applied: string;
}

export interface VacancyStatusNextRow {
  status: string;
  next: string;
  applied: string;
}

export function isStaleApplication(v: VacancyStatusNextRow, nowMs: number): boolean {
  if (!WAITING_STATUSES.includes(v.status) || !v.applied) return false;
  const appliedMs = new Date(v.applied).getTime();
  if (Number.isNaN(appliedMs)) return false;
  return (nowMs - appliedMs) / 86_400_000 > STALE_APPLICATION_DAYS;
}

export interface AnalyticsSummary {
  funnel: Record<string, number>;
  funnelReached: Record<string, number>;
  byDate: Record<string, number>;
}

// Note: the "skill radar" used to be built here (top-8 demand vs. a binary "known" flag). It now
// lives entirely on the roadmap side (server/src/modules/roadmap/skill-level.ts +
// roadmap.service.ts's per-node `level`), which already has richer per-tech signals (roadmap
// status, drills, SRS recall) than this route ever loaded — see client's
// features/roadmap/radar-data.ts for how the client builds the chart from GET /roadmap.
export function buildAnalyticsSummary(rows: VacancyStatusRow[], reached: Record<string, number>): AnalyticsSummary {
  const funnel: Record<string, number> = {};
  FUNNEL_ORDER.forEach((s) => (funnel[s] = 0));
  const byDate: Record<string, number> = {};
  rows.forEach((v) => {
    funnel[v.status] = (funnel[v.status] || 0) + 1;
    const d = v.created || "";
    if (d) byDate[d] = (byDate[d] || 0) + 1;
  });
  // funnel is only the CURRENT distribution (a snapshot of "where the vacancy is now"): a
  // vacancy rejected at the "Tech interview" stage no longer counts there, because the status
  // was overwritten to "Rejected" — it looks like it never got there. funnelReached is how many
  // vacancies EVER had each status (from vacancy_status_history), i.e. an honest funnel of
  // stage progression regardless of the final outcome.
  const funnelReached: Record<string, number> = {};
  FUNNEL_ORDER.forEach((s) => (funnelReached[s] = reached[s] || 0));
  return { funnel, funnelReached, byDate };
}

export interface FocusSummary {
  totalVac: number;
  interviews: number;
  overdue: number;
  upcoming: number;
  funnel: Record<string, number>;
  gaps: string[];
  skillsCount: number;
  dueCards: number;
  staleApplications: number;
}

/**
 * What area of the app an action is about — the ONLY routing hint that crosses the wire. A closed
 * enum, never a URL: the server has no business knowing the client's route table, and an LLM
 * asked to emit a path would happily invent one that 404s. The client maps kind → destination
 * (client/src/features/dashboard/focus-destination.ts).
 *
 * Kept as a Zod-validated field on the LLM's own response (see FocusActionsSchema in
 * analytics.routes.ts) rather than guessed from the action's wording, so a value outside this
 * list is a schema mismatch that `chatJson` self-repairs, not a silently-broken link.
 */
export const FOCUS_ACTION_KINDS = ["vacancies", "interviews", "skills", "cards", "contacts", "cv"] as const;
export type FocusActionKind = (typeof FOCUS_ACTION_KINDS)[number];

/**
 * Which heuristic rule produced an action. Only the OFFLINE fallback (heuristicFocus below) sets
 * this — an LLM-written action has prose of its own, already in the user's language via `chat()`'s
 * `outputLocale: "app"`.
 *
 * It exists because that fallback's `title`/`why` are hardcoded English, and this card is the most
 * prominent thing on the dashboard: without an LLM key — the app's documented, fully-supported
 * offline mode — a Ukrainian user was reading English advice. Rather than build a message catalog
 * plus Slavic one/few/many plural logic on the server (which has no i18n runtime; see CLAUDE.md's
 * "server i18n" notes), the server sends the rule id and its numbers, and the CLIENT renders it
 * through i18next — which already does correct uk pluralization for free. `title`/`why` stay
 * populated as an English fallback so any consumer that doesn't know about `code` still shows
 * something sensible.
 */
export const FOCUS_ACTION_CODES = ["overdue", "interviews", "gap", "moreVacancies", "dueCards", "stale"] as const;
export type FocusActionCode = (typeof FOCUS_ACTION_CODES)[number];

export interface FocusAction {
  title: string;
  why: string;
  /** Optional — an action the model couldn't classify simply renders as plain text, exactly as
   * every action did before this field existed. */
  kind?: FocusActionKind;
  /** Set only by heuristicFocus(); absent on LLM-authored actions. */
  code?: FocusActionCode;
  /** Interpolation values for `code`'s translated message (counts, tech name). */
  params?: Record<string, string | number>;
}

export interface BuildFocusSummaryInput {
  rows: VacancyStatusNextRow[];
  demand: Record<string, number>;
  /** gapPriorityMap()'s output — decides WHICH gaps make the list and in what order; `demand`
   * above is still used for each gap's displayed count. */
  gapPriority: Record<string, number>;
  knownSkills: string[];
  dueCards: number;
  today: string;
  nowMs: number;
}

export function buildFocusSummary(input: BuildFocusSummaryInput): FocusSummary {
  const known = new Set(input.knownSkills);
  // Ranked by gapPriority (which gap unlocks the most vacancies), not raw demand (which merely
  // mentions it most) — see shared/demand.ts's computeGapPriority for why the two can disagree.
  const gaps = topGapTechs(input.knownSkills, input.gapPriority, 5).map((t) => `${t} (${input.demand[t] || 0})`);
  const funnel: Record<string, number> = {};
  input.rows.forEach((v) => (funnel[v.status] = (funnel[v.status] || 0) + 1));
  return {
    totalVac: input.rows.length,
    interviews: input.rows.filter((v) => ["Tech interview", "Take-home task", "Final"].includes(v.status)).length,
    overdue: input.rows.filter((v) => v.next && v.next < input.today).length,
    upcoming: input.rows.filter((v) => v.next && v.next >= input.today).length,
    funnel,
    gaps,
    skillsCount: known.size,
    dueCards: input.dueCards,
    staleApplications: input.rows.filter((v) => isStaleApplication(v, input.nowMs)).length,
  };
}

// ---------- "Focus of the week": the LLM analyzes the whole state and gives 3 concrete actions ----------
export function heuristicFocus(s: FocusSummary): FocusAction[] {
  const actions: FocusAction[] = [];
  if (s.overdue > 0)
    actions.push({
      // English `title`/`why` throughout this function are a FALLBACK, not what the dashboard
      // renders — the client translates `code` + `params` instead (see FOCUS_ACTION_CODES above).
      // They also stay deliberately literal so the two never drift in meaning.
      title: `Update ${s.overdue} overdue steps`,
      why: 'There are vacancies with a "next step" date in the past — don\'t lose the contact.',
      kind: "vacancies",
      code: "overdue",
      params: { count: s.overdue },
    });
  if (s.interviews > 0)
    actions.push({
      title: "Prepare for interviews",
      why: `${s.interviews} vacancies at the interview stage — do a "Mock interview" and review your cards.`,
      kind: "interviews",
      code: "interviews",
      params: { count: s.interviews },
    });
  if (s.gaps.length > 0)
    actions.push({
      title: `Close the "${s.gaps[0]}" gap`,
      why: "Missing from your profile, and the single skill that would newly qualify you for the most tracked vacancies.",
      kind: "skills",
      code: "gap",
      // `gaps[0]` is already "Tech (count)" (see buildFocusSummary) — a display string, passed
      // through as-is rather than re-derived, so the two paths can't disagree on which gap won.
      params: { gap: s.gaps[0] ?? "" },
    });
  if (s.totalVac < 3)
    actions.push({
      title: "Add more vacancies",
      why: "A small sample — import vacancies so the analytics and roadmap are more accurate.",
      kind: "vacancies",
      code: "moreVacancies",
    });
  if (s.dueCards > 0)
    actions.push({
      title: `Review ${s.dueCards} cards`,
      why: "There are cards due for review today — keep your knowledge fresh with the SRS algorithm.",
      kind: "cards",
      code: "dueCards",
      params: { count: s.dueCards },
    });
  if (s.staleApplications > 0)
    actions.push({
      title: `Nudge ${s.staleApplications} vacancies with no response`,
      why: `More than ${STALE_APPLICATION_DAYS} days of silence after applying — send the recruiter a follow-up or mark it "Rejected" if it's no longer relevant.`,
      kind: "contacts",
      code: "stale",
      params: { count: s.staleApplications, days: STALE_APPLICATION_DAYS },
    });
  return actions.slice(0, 3);
}
