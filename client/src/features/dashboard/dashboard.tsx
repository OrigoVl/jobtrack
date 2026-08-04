import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useHealth, useLearn, useProfile, useRoadmap, useStudy, useVacancies } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, Chip, PageHeader, ProgressBar } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import { useToast } from "../../shared/use-toast";
import { statusLabel } from "../../shared/status-labels";
import {
  enableNotifications,
  disableNotifications,
  notificationsEnabled,
  notificationsSupported,
  maybeNotifyFollowUps,
} from "../../shared/notifications";
import type { FocusWeek } from "../../shared/types";

function FocusWeekCard({ llm }: { llm: boolean }) {
  const { t } = useTranslation("dashboard");
  const [data, setData] = useState<FocusWeek | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api
      .focusWeek()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ actions: [] }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <Card className="!bg-gradient-to-br !from-signal/10 !to-white !border-signal/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-signal">{t("focusWeek.heading")}</span>
        {data && !data.offline && llm && <Chip tone="indigo">AI</Chip>}
      </div>
      {loading && <div className="text-sm text-ink-dim">{t("focusWeek.analyzing")}</div>}
      {!loading && data && data.actions.length > 0 && (
        <ol className="space-y-2">
          {data.actions.map((a, i) => (
            <li key={`${a.title}-${i}`} className="flex gap-2.5 text-sm">
              <span className="shrink-0 w-5 h-5 rounded-full bg-signal text-white text-xs font-bold flex items-center justify-center">
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
export function Dashboard({ go }: { go: (t: string) => void }) {
  const { t } = useTranslation("dashboard");
  const { data: vacancies = [], isLoading: loadingVacancies } = useVacancies();
  const { data: study } = useStudy();
  const { data: roadmap } = useRoadmap();
  const { data: learn } = useLearn();
  const { data: health } = useHealth();
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const [notifOn, setNotifOn] = useState(() => notificationsEnabled());
  const llm = health?.llm ?? false;
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = vacancies.filter((x) => x.next && x.next < today).length;
  const dueTodayCount = vacancies.filter((x) => x.next === today).length;
  useEffect(() => {
    if (vacancies.length > 0) maybeNotifyFollowUps(overdueCount, dueTodayCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once a day reminder, regardless of further re-renders
  }, [vacancies.length]);
  const onEnableNotifications = async () => {
    const ok = await enableNotifications();
    setNotifOn(ok);
    toast(ok ? t("notifications.enabledToast") : t("notifications.deniedToast"), ok ? "success" : "error");
  };
  const onDisableNotifications = () => {
    disableNotifications();
    setNotifOn(false);
    toast(t("notifications.disabledToast"), "success");
  };
  if (loadingVacancies) return <CardsSkeleton count={4} />;
  const active = vacancies.filter((x) => !["Rejected", "Paused", "Want to apply"].includes(x.status)).length;
  const iv = vacancies.filter((x) => ["Tech interview", "Take-home task", "Final"].includes(x.status)).length;
  const upcoming = vacancies
    .filter((x) => x.next)
    .sort((a, b) => (a.next > b.next ? 1 : -1))
    .slice(0, 5);
  const stat = (n: string | number, l: string, c = "text-ink") => (
    <Card className="text-center">
      <div className={`text-3xl font-extrabold ${c}`}>{n}</div>
      <div className="text-xs text-ink-dim mt-1">{l}</div>
    </Card>
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={profile?.domain ? <Chip tone="indigo">🎯 {profile.domain}</Chip> : undefined}
      />

      {vacancies.length <= 1 && (
        <Card className="!bg-signal/10 !border-signal/30">
          <div className="font-semibold text-signal">{t("gettingStarted.heading")}</div>
          <ol className="text-sm text-signal/80 mt-2 space-y-1 list-decimal pl-5">
            <li>{t("gettingStarted.step1")}</li>
            <li>{t("gettingStarted.step2")}</li>
            <li>{t("gettingStarted.step3")}</li>
          </ol>
          <div className="flex gap-2 mt-3">
            <Btn size="sm" onClick={() => go("vacancies")}>
              {t("gettingStarted.addVacancies")}
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => go("roadmap")}>
              {t("gettingStarted.openRoadmap")}
            </Btn>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stat(vacancies.length, t("stats.totalVacancies"))}
        {stat(active, t("stats.active"), "text-signal")}
        {stat(iv, t("stats.inInterviews"), "text-alert")}
        {stat(`${study?.learned ?? 0}/${study?.total ?? 0}`, t("stats.cardsLearned"), "text-signal")}
      </div>

      {vacancies.length > 0 && <FocusWeekCard llm={llm} />}

      {roadmap && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-ink">{t("roadmapProgress.heading")}</div>
            <button onClick={() => go("roadmap")} className="text-sm text-signal hover:underline">
              {t("roadmapProgress.open")}
            </button>
          </div>
          <ProgressBar value={roadmap.progress.done} max={roadmap.progress.total} tone="emerald" />
          <div className="text-xs text-ink-dim mt-2">
            {t("roadmapProgress.skillsKnown", { done: roadmap.progress.done, total: roadmap.progress.total })}
            {/* Deliberately not "mastered" — this reflects the roadmap's manual "know it" toggle,
                not skills actually reinforced through Practice (see the separate "Cards learned" stat). */}
            {learn && learn.gaps.length > 0 && (
              <>
                {" · "}
                {t("roadmapProgress.topGap", { tech: learn.gaps[0].tech })}
              </>
            )}
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-ink">{t("upcomingSteps.heading")}</div>
            {notificationsSupported() &&
              (notifOn ? (
                <button
                  onClick={onDisableNotifications}
                  title={t("upcomingSteps.disableReminders")}
                  className="text-[11px] text-signal hover:text-rose-600 hover:underline"
                >
                  {t("upcomingSteps.remindersEnabled")}
                </button>
              ) : (
                <button onClick={onEnableNotifications} className="text-[11px] text-signal hover:underline">
                  {t("upcomingSteps.enableReminders")}
                </button>
              ))}
          </div>
          {upcoming.length === 0 ? (
            <div className="text-ink-dim text-sm">{t("upcomingSteps.empty")}</div>
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
        </Card>
        <Card>
          <div className="font-semibold mb-2 text-ink">{t("quickActions.heading")}</div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => go("analyzer")}>{t("quickActions.vacancyAnalysis")}</Btn>
            <Btn variant="ghost" onClick={() => go("roadmap")}>
              {t("quickActions.roadmap")}
            </Btn>
            <Btn variant="ghost" onClick={() => go("study")}>
              {t("quickActions.review")}
            </Btn>
            <Btn variant="ghost" onClick={() => go("cv")}>
              {t("quickActions.cvAnalysis")}
            </Btn>
          </div>
          <div className="text-xs text-ink-dim mt-3">
            {t("quickActions.cardsDueToday")} <b className="text-ink-dim">{study?.due.length ?? 0}</b>
          </div>
        </Card>
      </div>
    </div>
  );
}
