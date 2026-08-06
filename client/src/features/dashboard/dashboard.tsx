import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  useAnalytics,
  useApplyProgress,
  useCombinedCalendar,
  useContacts,
  useCvDoc,
  useCvProfiles,
  useFocusWeek,
  useHealth,
  useLearn,
  useProfile,
  useRoadmap,
  useSetWeeklyApplyGoal,
  useStudy,
  useVacancies,
} from "../../shared/queries";
import { Card, CardsSkeleton, Chip, Kicker, NumberedMark, PageHeader, ProgressBar, Select } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import { useFireCelebration } from "../../shared/use-celebration";
import { useCountUp } from "../../shared/use-count-up";
import { useUi } from "../../shared/ui-state";
import { statusLabel } from "../../shared/status-labels";
import { BriefcaseIcon, CalendarCheckIcon, CardsStackIcon, FlameIcon, PlayCircleIcon } from "../../shared/icons";
import { SkillRadarCard } from "./skill-radar-card";
import { buildRadarSeries, RADAR_AXES_COMPACT, RADAR_MIN_AXES } from "../roadmap/radar-data";
import { ResumeCompleteness } from "../cv/builder/resume-completeness";
import { maybeNotifyFollowUps } from "../../shared/notifications";
import { findUpcomingDesignInterview } from "../../shared/design-reminders";

// How far ahead the "upcoming events" mini-list looks — matches the Analyzer/Calendar's own
// week-ish planning horizon; long enough to be useful, short enough to stay "what's actually
// coming up soon" rather than every event ever scheduled.
const CALENDAR_LOOKAHEAD_DAYS = 14;
// Longer lookahead than CalendarReminderNotifier's 15-minute "it's starting now" window — this is
// "go prepare," not "join the call," so it needs days of notice, not minutes.
const DESIGN_REMINDER_LOOKAHEAD_DAYS = 3;
// A contact not touched in this many days surfaces as "reach out again" — long enough that a
// perfectly normal in-progress conversation (a week of back-and-forth) never gets flagged, short
// enough to actually catch a recruiter thread that's gone quiet.
const STALE_CONTACT_DAYS = 14;

/** The dashboard's one "highlighted" card — an indigo-bordered glow, matching the landing's own
 * `.compare-new` treatment for "the one that matters" (`border-color: var(--accent); box-shadow:
 * 0 20px 40px -24px color-mix(in srgb, var(--accent) 35%, transparent)`), not a separate dark
 * "night sky" world — this landing has no dark section anywhere to mirror. */
function FocusWeekCard({ llm }: { llm: boolean }) {
  const { t } = useTranslation("dashboard");
  // A query error (network/auth) is treated the same as "no actions" below, same as the old
  // manual .catch(() => setData({ actions: [] })) — it's not the same thing as the server's own
  // `offline: true` (LLM unavailable, heuristic fallback still returned actions successfully).
  const { data, isLoading: loading } = useFocusWeek();
  return (
    <Card className="!border-signal/30 shadow-[0_20px_40px_-24px_rgb(var(--star)/0.35)]">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-display text-lg font-bold text-ink">{t("focusWeek.heading")}</span>
        {data && !data.offline && llm && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-signal/30 bg-signal/10 text-signal">
            AI
          </span>
        )}
      </div>
      {loading && <div className="text-sm text-ink-dim">{t("focusWeek.analyzing")}</div>}
      {!loading && data && data.actions.length > 0 && (
        <ol className="space-y-2">
          {data.actions.map((a, i) => (
            <li key={`${a.title}-${i}`} className="flex gap-2.5 text-sm">
              <span className="shrink-0 w-5 h-5 rounded-full bg-star text-on-signal text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span>
                <b className="text-ink">{a.title}.</b>{" "}
                <span className="text-ink-dim">
                  <Markdown text={a.why} inline />
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {!loading && (!data || data.actions.length === 0) && <div className="text-sm text-ink-dim">{t("focusWeek.empty")}</div>}
      {data?.offline && <div className="text-xs text-ink-dim mt-2">{t("focusWeek.offline")}</div>}
    </Card>
  );
}
// Server (shared/validation.ts#parseWeeklyApplyGoalInput) accepts any integer 1-50 — this list is
// just the UI's curated shortcut set, not the actual ceiling.
const WEEKLY_GOAL_OPTIONS = [3, 5, 7, 10, 15, 20, 25, 30];

/** A dedicated card rather than a sixth StatTile in the bento row below — that row's
 * grid-cols-4 is already a deliberate 1-hero + 4-tile layout, and this needs its own
 * interactive control (the weekly-goal picker) that a fixed-height stat tile has no room for. */
function ApplyStreakCard() {
  const { t } = useTranslation("dashboard");
  const { data } = useApplyProgress();
  const setGoal = useSetWeeklyApplyGoal();
  if (!data) return null;
  const streak = data.streak.current;
  return (
    <Card className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <FlameIcon className={`w-6 h-6 shrink-0 ${streak > 0 ? "text-alert" : "text-ink-dim"}`} />
        <div>
          <div className="font-semibold text-ink">
            {streak > 0 ? t("applyStreak.heading", { count: streak }) : t("applyStreak.headingEmpty")}
          </div>
          <div className="text-xs text-ink-dim mt-0.5">
            {t("applyStreak.weekly", { applied: data.appliedThisWeek, goal: data.weeklyGoal })}
            {data.appliedThisWeek > data.weeklyGoal && (
              <span className="text-good font-semibold ml-1.5">
                {t("applyStreak.goalExceeded", { count: data.appliedThisWeek - data.weeklyGoal })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-1 min-w-[160px] sm:max-w-[280px]">
        <ProgressBar value={data.appliedThisWeek} max={data.weeklyGoal} />
        <Select
          aria-label={t("applyStreak.goalLabel")}
          value={data.weeklyGoal}
          onChange={(e) => setGoal.mutate(Number(e.target.value))}
          className="shrink-0 !text-xs !py-1"
        >
          {WEEKLY_GOAL_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {t("applyStreak.goalOption", { count: n })}
            </option>
          ))}
        </Select>
      </div>
    </Card>
  );
}

/** Renders a stat's figure — plain text as-is, but a real number counts up from 0 (see
 * shared/use-count-up.ts) rather than just appearing, so a resolved/changed stat draws the eye.
 * A tiny subcomponent (not inline in StatTile) because hooks can't be called conditionally on
 * `typeof value`, and the two `StatTile` call sites pass either a number or a pre-formatted
 * string (e.g. "22/173"), which isn't itself something `useCountUp` can animate. */
function AnimatedValue({ value }: { value: string | number }) {
  const numeric = typeof value === "number" ? value : null;
  // Always called (never conditionally, per rules-of-hooks) — target is just 0 and its result
  // discarded when `value` isn't a number, since a pre-formatted string (e.g. "22/173") has no
  // single number to count up to.
  const counted = useCountUp(numeric ?? 0);
  return <>{numeric != null ? counted : value}</>;
}

/** One bento tile in the stat row — fixed-height regardless of whether `extra` (a second,
 * smaller line under the label — e.g. "3 due today") is present, so the row never jumps between
 * tall/short cells. `tintClass` is a light background wash hinting at the tile's theme (e.g.
 * `bg-signal/5`); `colorClass` for the number itself defaults to plain ink — a big filled number
 * in the deepened accent hue reads as dull/muddy rather than vivid, so the accent is kept to the
 * subtle background wash only. `size="lg"` is the one "hero" tile in the row (see the asymmetric layout
 * below, echoing the landing page's own asymmetric pillar grid) — bigger figure, bigger icon,
 * left-aligned label instead of stacked. `delayMs` staggers this tile's entrance fade-in relative
 * to its siblings (each passes a slightly later value) — the shared `main > *` fade-in
 * (index.css) only covers the bento row as ONE unit, so without this all five tiles would still
 * pop in simultaneously instead of cascading. Not `fill-mode: forwards`/`both` on `main`'s own
 * rule (see that rule's caution comment re: fixed-position containing blocks) — but safe here
 * with `backwards`, since a stat tile never hosts a fixed-position descendant. */
function StatTile({
  icon,
  value,
  label,
  extra,
  colorClass = "text-ink",
  tintClass = "bg-surface-2/60",
  size = "sm",
  delayMs = 0,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  extra?: string;
  colorClass?: string;
  tintClass?: string;
  size?: "sm" | "lg";
  delayMs?: number;
}) {
  const entrance = { animation: `jt-fade-in 0.4s ease-out ${delayMs}ms backwards` };
  if (size === "lg") {
    // A visible accent border + wash (not just bigger type) so this tile unmistakably reads as
    // the headline figure next to the smaller cluster beside it — size difference alone wasn't
    // enough to read as "asymmetric" rather than "same row, one card slightly bigger".
    return (
      <div
        style={entrance}
        className="h-full rounded-card card-shadow card-shadow-hover border border-signal/25 bg-gradient-to-br from-signal/[0.06] to-surface px-5 py-4 flex flex-col justify-between"
      >
        {/* `mb-4` is a floor, not just a `justify-between` leftover — on a short row (row height
            set by the shorter small-tile cluster beside it) `justify-between` alone had almost no
            slack to distribute, so the icon sat almost flush against "22" below it. */}
        <div className={`${colorClass} [&_svg]:w-5 [&_svg]:h-5 mb-4`}>{icon}</div>
        <div>
          <div className={`text-5xl font-bold font-display tabular-nums ${colorClass}`}>
            <AnimatedValue value={value} />
          </div>
          <div className="text-sm text-ink-dim mt-1.5">{label}</div>
          <div className="text-[11px] text-ink-dim min-h-[14px]">{extra}</div>
        </div>
      </div>
    );
  }
  return (
    <div
      style={entrance}
      className={`shrink-0 w-[112px] sm:w-auto rounded-card card-shadow card-shadow-hover border border-grid px-3 py-2.5 ${tintClass}`}
    >
      <div className={colorClass}>{icon}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${colorClass}`}>
        <AnimatedValue value={value} />
      </div>
      <div className="text-[11px] text-ink-dim mt-0.5">{label}</div>
      <div className="text-[11px] text-ink-dim min-h-[14px]">{extra}</div>
    </div>
  );
}

export function Dashboard({ go }: { go: (t: string) => void }) {
  const { t, i18n } = useTranslation("dashboard");
  const { data: vacancies = [], isLoading: loadingVacancies } = useVacancies();
  const { data: study } = useStudy();
  const { data: roadmap } = useRoadmap();
  const { data: learn } = useLearn();
  const { data: health } = useHealth();
  const { data: profile } = useProfile();
  const { data: analytics } = useAnalytics();
  // Dashboard shows the first (default) CV profile's completeness — same "just the default one"
  // choice cv.tsx's legacy upload flow makes; there's no per-tab context on this page to pick a
  // specific profile from.
  const { data: cvProfiles } = useCvProfiles();
  const { data: cvDoc } = useCvDoc(cvProfiles?.[0]?.id);
  const { data: contacts = [] } = useContacts();
  const fireCelebration = useFireCelebration();
  const llm = health?.llm ?? false;
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = vacancies.filter((x) => x.next && x.next < today).length;
  const dueTodayCount = vacancies.filter((x) => x.next === today).length;
  const calendarRangeTo = new Date(Date.now() + CALENDAR_LOOKAHEAD_DAYS * 86400000).toISOString().slice(0, 10);
  const { data: calendar } = useCombinedCalendar({ from: today, to: calendarRangeTo });
  const [, setStudyMode] = useUi<"srs" | "drill" | "mock" | "design">("study.mode", "srs");
  const designInterviewSoon = findUpcomingDesignInterview(calendar?.events ?? [], Date.now(), DESIGN_REMINDER_LOOKAHEAD_DAYS);
  const designReminderDays = designInterviewSoon
    ? Math.max(1, Math.ceil((new Date(designInterviewSoon.startAt).getTime() - Date.now()) / 86_400_000))
    : 0;
  const goPracticeDesign = () => {
    setStudyMode("design");
    go("study");
  };
  const eventDateLabel = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric" }), [i18n.language]);
  const upcomingEvents = (calendar?.events ?? []).filter((e) => e.startAt.slice(0, 10) >= today).slice(0, 3);
  // Longest-stuck stage first (server-side, analytics.service.ts), already filtered to stages
  // with at least 2 vacancies (a single sample isn't a real average) — same data the full /analytics
  // page charts, but this is a single-figure callout, not a duplicate of that page's bar chart.
  const bottleneck = analytics && analytics.stageDurations.length > 0 ? analytics.stageDurations[0] : undefined;
  const topStrengths = (learn?.strengths ?? []).slice(0, 3);
  const staleContacts = contacts
    .filter((c) => c.lastContactAt)
    .map((c) => ({ ...c, daysSince: Math.floor((Date.now() - new Date(c.lastContactAt).getTime()) / 86400000) }))
    .filter((c) => c.daysSince >= STALE_CONTACT_DAYS)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 3);
  useEffect(() => {
    if (vacancies.length > 0) maybeNotifyFollowUps(overdueCount, dueTodayCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once a day reminder, regardless of further re-renders
  }, [vacancies.length]);
  // Real product signals, not a "have you visited this page" flag — each step reflects something
  // the user actually did (persisted server-side already), so it survives reloads and can't be
  // gamed by just clicking through pages. Hidden once every step is done (see onboardingRemaining
  // below), same as the single-card version this replaces. Computed above the loadingVacancies
  // early return (with the hooks that react to it) so hook order stays identical across renders.
  const onboardingSteps = [
    {
      done: vacancies.length > 0,
      path: "vacancies",
      labelKey: "onboarding.steps.vacancy" as const,
      ctaKey: "onboarding.cta.vacancy" as const,
    },
    {
      done: (profile?.skills.length ?? 0) > 0,
      path: "cv",
      labelKey: "onboarding.steps.profile" as const,
      ctaKey: "onboarding.cta.profile" as const,
    },
    {
      done: (roadmap?.progress.done ?? 0) > 0,
      path: "roadmap",
      labelKey: "onboarding.steps.roadmap" as const,
      ctaKey: "onboarding.cta.roadmap" as const,
    },
    {
      done: (study?.learned ?? 0) > 0 || Object.keys(study?.drillProgress ?? {}).length > 0,
      path: "study",
      labelKey: "onboarding.steps.practice" as const,
      ctaKey: "onboarding.cta.practice" as const,
    },
  ];
  const onboardingDone = onboardingSteps.filter((s) => s.done).length;
  const onboardingRemaining = onboardingSteps.length - onboardingDone;
  // Fires the confetti celebration the moment the checklist first hits 100% — gated on
  // `dataSettled` so the load waterfall (profile/roadmap/study each resolve independently) can't
  // be mistaken for the user just having finished the last step: `prevRemainingRef` only starts
  // recording once every query behind onboardingSteps has data, so the very first "settled" render
  // just establishes the baseline instead of comparing against transient loading defaults.
  const dataSettled = profile !== undefined && roadmap !== undefined && study !== undefined;
  const prevRemainingRef = useRef<number | null>(null);
  const [onboardingCelebrated, setOnboardingCelebrated] = useUi("dashboard.onboardingCelebrated", false);
  useEffect(() => {
    if (!dataSettled) return;
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = onboardingRemaining;
    if (!onboardingCelebrated && prev !== null && prev > 0 && onboardingRemaining === 0) {
      fireCelebration(t("onboarding.celebration"));
      setOnboardingCelebrated(true);
    }
  }, [dataSettled, onboardingRemaining, onboardingCelebrated, setOnboardingCelebrated, t, fireCelebration]);
  if (loadingVacancies) return <CardsSkeleton count={4} />;
  const active = vacancies.filter((x) => !["Rejected", "Paused", "Want to apply"].includes(x.status)).length;
  const iv = vacancies.filter((x) => ["Tech interview", "Take-home task", "Final"].includes(x.status)).length;
  const upcoming = vacancies
    .filter((x) => x.next)
    .sort((a, b) => (a.next > b.next ? 1 : -1))
    .slice(0, 5);
  // Mirrors SkillRadarCard's own null-check (see skill-radar-card.tsx) so the sibling "Progress &
  // next steps" card knows, ahead of render, whether the radar will actually take up its column
  // — letting it stretch to the full row instead of leaving a dead 1/3-width gap.
  const skillRadarAxes = roadmap
    ? buildRadarSeries(
        roadmap.groups.flatMap((g) => g.nodes),
        RADAR_AXES_COMPACT,
      )
    : [];
  const skillRadarRenders = skillRadarAxes.length >= RADAR_MIN_AXES;
  const streakCurrent = study?.streak.current ?? 0;
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={profile?.domain ? <Chip tone="indigo">{profile.domain}</Chip> : undefined}
      />

      {onboardingRemaining > 0 && (
        <Card className="!border-signal/30">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="font-semibold text-ink">{t("onboarding.heading")}</div>
            <div className="text-xs text-ink-dim">{t("onboarding.progress", { done: onboardingDone, total: onboardingSteps.length })}</div>
          </div>
          <div className="space-y-1.5">
            {onboardingSteps.map((s, i) =>
              s.done ? (
                <div key={s.labelKey} className="flex items-center gap-2.5 text-sm">
                  <span className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0 bg-star text-on-signal">
                    ✓
                  </span>
                  <span className="text-ink-dim line-through">{t(s.labelKey)}</span>
                </div>
              ) : (
                <div key={s.labelKey} className="flex items-center gap-2.5 text-sm">
                  <NumberedMark n={i + 1} />
                  <span className="text-ink">{t(s.labelKey)}</span>
                  <button
                    onClick={() => go(s.path)}
                    className="ml-auto text-xs font-medium text-ink-dim hover:text-signal hover:underline shrink-0"
                  >
                    {t(s.ctaKey)}
                  </button>
                </div>
              ),
            )}
          </div>
        </Card>
      )}

      {designInterviewSoon && (
        <Card className="!border-alert/30 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-ink">{t("designReminder.heading")}</div>
            <div className="text-sm text-ink-dim mt-0.5">{t("designReminder.message", { count: designReminderDays })}</div>
          </div>
          <button
            onClick={goPracticeDesign}
            className="text-sm font-medium text-signal hover:underline shrink-0 border border-signal/30 bg-signal/10 rounded-lg px-3 py-1.5"
          >
            {t("designReminder.cta")}
          </button>
        </Card>
      )}

      {vacancies.length > 0 && <FocusWeekCard llm={llm} />}
      {vacancies.length > 0 && <ApplyStreakCard />}

      <div>
        {/* Asymmetric bento — one hero figure (the headline number) beside a tighter 2x2/1x4
            cluster of supporting stats, echoing the landing page's own asymmetric pillar grid
            rather than five identical tiles in a row. */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="sm:w-[260px] shrink-0">
            <StatTile
              size="lg"
              icon={<BriefcaseIcon className="w-4 h-4" />}
              value={vacancies.length}
              label={t("stats.totalVacancies")}
              delayMs={0}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            <StatTile
              icon={<PlayCircleIcon className="w-4 h-4" />}
              value={active}
              label={t("stats.active")}
              colorClass="text-ink"
              tintClass="bg-signal/5"
              delayMs={60}
            />
            <StatTile
              icon={<CalendarCheckIcon className="w-4 h-4" />}
              value={iv}
              label={t("stats.inInterviews")}
              colorClass="text-alert"
              tintClass="bg-alert/5"
              delayMs={120}
            />
            <StatTile
              icon={<CardsStackIcon className="w-4 h-4" />}
              value={`${study?.learned ?? 0}/${study?.total ?? 0}`}
              label={t("stats.cardsLearned")}
              colorClass="text-ink"
              tintClass="bg-signal/5"
              extra={(study?.due.length ?? 0) > 0 ? t("stats.dueToday", { count: study?.due.length ?? 0 }) : undefined}
              delayMs={180}
            />
            <StatTile
              icon={<FlameIcon className="w-4 h-4" />}
              value={streakCurrent}
              label={t("stats.streak")}
              colorClass={streakCurrent > 0 ? "text-alert" : "text-ink"}
              tintClass={streakCurrent > 0 ? "bg-alert/5" : "bg-surface-2/60"}
              extra={(study?.streak.longest ?? 0) > 0 ? t("stats.streakRecord", { count: study?.streak.longest ?? 0 }) : undefined}
              delayMs={240}
            />
          </div>
        </div>
        {bottleneck && (
          <Kicker className="mt-4">
            {t("bottleneck.text", { status: statusLabel(bottleneck.status), days: Math.round(bottleneck.avgDays) })}
          </Kicker>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4 items-start">
        {roadmap && skillRadarRenders && <SkillRadarCard nodes={roadmap.groups.flatMap((g) => g.nodes)} onOpen={() => go("roadmap")} />}
        <Card className={skillRadarRenders ? "md:col-span-2" : "md:col-span-3"}>
          <div className="font-semibold mb-2 text-ink">{t("progressNext.heading")}</div>
          <div className="grid sm:grid-cols-2 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-grid">
            <div className="sm:pr-4">
              {roadmap && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-ink">{t("roadmapProgress.heading")}</div>
                    <button onClick={() => go("roadmap")} className="text-sm text-ink-dim hover:text-signal hover:underline">
                      {t("roadmapProgress.open")}
                    </button>
                  </div>
                  <ProgressBar value={roadmap.progress.done} max={roadmap.progress.total} tone="emerald" />
                  <div className="text-xs text-ink-dim mt-2">
                    {t("roadmapProgress.skillsKnown", { done: roadmap.progress.done, total: roadmap.progress.total })}
                    {/* Deliberately not "mastered" — this reflects the roadmap's manual "know it" toggle,
                        not skills actually reinforced through Practice (see the separate "Cards learned" stat). */}
                    {roadmap.progress.learning > 0 && (
                      <>
                        {" · "}
                        {t("roadmapProgress.learning", { count: roadmap.progress.learning })}
                      </>
                    )}
                    {learn && learn.gaps.length > 0 && (
                      <>
                        {" · "}
                        {t("roadmapProgress.topGap", { tech: learn.gaps[0].tech })}
                      </>
                    )}
                  </div>
                  {topStrengths.length > 0 && (
                    <div className="text-xs text-ink-dim mt-1">
                      {t("roadmapProgress.strengths", { techs: topStrengths.map((s) => s.tech).join(", ") })}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="sm:pl-4 pt-4 sm:pt-0">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-ink">{t("upcomingSteps.heading")}</div>
              </div>
              {upcoming.length === 0 ? (
                <div>
                  <div className="text-ink-dim text-sm">{t("upcomingSteps.empty")}</div>
                  <button onClick={() => go("vacancies")} className="mt-1 text-sm text-ink-dim hover:text-signal hover:underline">
                    {t("upcomingSteps.emptyCta")}
                  </button>
                </div>
              ) : (
                upcoming.map((u) => (
                  <div key={u.id} className="flex justify-between text-sm py-1.5 border-b border-surface-2 last:border-0">
                    <span>
                      {u.company} — <span className="text-ink-dim">{statusLabel(u.status)}</span>
                    </span>
                    <span className="text-alert font-medium">{u.next}</span>
                  </div>
                ))
              )}
              {upcomingEvents.length > 0 && (
                <div className="mt-2 pt-2 border-t border-surface-2 space-y-1">
                  <div className="text-[11px] font-semibold text-ink-dim uppercase tracking-wide">{t("upcomingSteps.eventsHeading")}</div>
                  {upcomingEvents.map((e) => (
                    <div key={e.id} className="flex justify-between text-xs py-0.5">
                      <span className="truncate">{e.title}</span>
                      <span className="text-ink-dim shrink-0 ml-2">{eventDateLabel.format(new Date(e.startAt))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {(cvDoc || staleContacts.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {cvDoc && (
            <Card className={staleContacts.length === 0 ? "md:col-span-2" : undefined}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-ink">{t("cvCompleteness.heading")}</div>
                <button onClick={() => go("cv")} className="text-sm text-ink-dim hover:text-signal hover:underline">
                  {t("cvCompleteness.open")}
                </button>
              </div>
              <ResumeCompleteness doc={cvDoc} bare />
            </Card>
          )}
          {staleContacts.length > 0 && (
            <Card className={!cvDoc ? "md:col-span-2" : undefined}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-ink">{t("staleContacts.heading")}</div>
                <button onClick={() => go("contacts")} className="text-sm text-ink-dim hover:text-signal hover:underline">
                  {t("staleContacts.open")}
                </button>
              </div>
              <div className="space-y-1">
                {staleContacts.map((c) => (
                  <div key={c.id} className="flex justify-between text-sm py-1 border-b border-surface-2 last:border-0">
                    <span>
                      {c.name}
                      {c.role && <span className="text-ink-dim"> — {c.role}</span>}
                    </span>
                    <span className="text-ink-dim text-xs shrink-0 ml-2">{t("staleContacts.daysSince", { count: c.daysSince })}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
