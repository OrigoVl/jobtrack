// Pure, DB-free analytics/focus computation — split out of analytics.routes.ts so the funnel
// math and the heuristic "focus of the week" fallback are unit-testable without an Express
// request/response and a live DB (same reasoning as shared/demand.ts's computeDemand()).

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
  radar: { tech: string; demand: number; you: number }[];
}

export function buildAnalyticsSummary(
  rows: VacancyStatusRow[],
  reached: Record<string, number>,
  demand: Record<string, number>,
  knownSkills: string[],
): AnalyticsSummary {
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
  const known = new Set(knownSkills);
  const radar = Object.entries(demand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tech, cnt]) => ({ tech, demand: cnt, you: known.has(tech) ? cnt : 0 }));
  return { funnel, funnelReached, byDate, radar };
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

export interface FocusAction {
  title: string;
  why: string;
}

export interface BuildFocusSummaryInput {
  rows: VacancyStatusNextRow[];
  demand: Record<string, number>;
  knownSkills: string[];
  dueCards: number;
  today: string;
  nowMs: number;
}

export function buildFocusSummary(input: BuildFocusSummaryInput): FocusSummary {
  const known = new Set(input.knownSkills);
  const gaps = Object.entries(input.demand)
    .filter(([t]) => !known.has(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, c]) => `${t} (${c})`);
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
      title: `Update ${s.overdue} overdue steps`,
      why: 'There are vacancies with a "next step" date in the past — don\'t lose the contact.',
    });
  if (s.interviews > 0)
    actions.push({
      title: "Prepare for interviews",
      why: `${s.interviews} vacancies at the interview stage — do a "Mock interview" and review your cards.`,
    });
  if (s.gaps.length > 0)
    actions.push({
      title: `Close the "${s.gaps[0]}" gap`,
      why: "The most in-demand technology on the list that's missing from your profile.",
    });
  if (s.totalVac < 3)
    actions.push({ title: "Add more vacancies", why: "A small sample — import vacancies so the analytics and roadmap are more accurate." });
  if (s.dueCards > 0)
    actions.push({
      title: `Review ${s.dueCards} cards`,
      why: "There are cards due for review today — keep your knowledge fresh with the SRS algorithm.",
    });
  if (s.staleApplications > 0)
    actions.push({
      title: `Nudge ${s.staleApplications} vacancies with no response`,
      why: `More than ${STALE_APPLICATION_DAYS} days of silence after applying — send the recruiter a follow-up or mark it "Rejected" if it's no longer relevant.`,
    });
  return actions.slice(0, 3);
}
