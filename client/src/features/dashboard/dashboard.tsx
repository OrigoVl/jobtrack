import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import { useHealth, useLearn, useProfile, useRoadmap, useStudy, useVacancies } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, Chip, PageHeader, ProgressBar } from "../../shared/ui";
import { useToast } from "../../shared/use-toast";
import {
  enableNotifications,
  disableNotifications,
  notificationsEnabled,
  notificationsSupported,
  maybeNotifyFollowUps,
} from "../../shared/notifications";
import type { FocusWeek } from "../../shared/types";

function FocusWeekCard({ llm }: { llm: boolean }) {
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
    <Card className="!bg-gradient-to-br !from-indigo-50 !to-white !border-indigo-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-indigo-900">🎯 Focus of the week</span>
        {data && !data.offline && llm && <Chip tone="indigo">AI</Chip>}
      </div>
      {loading && <div className="text-sm text-slate-400">✨ Analyzing your search status…</div>}
      {!loading && data && data.actions.length > 0 && (
        <ol className="space-y-2">
          {data.actions.map((a, i) => (
            <li key={`${a.title}-${i}`} className="flex gap-2.5 text-sm">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span>
                <b className="text-slate-800">{a.title}.</b> <span className="text-slate-600">{a.why}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {!loading && (!data || data.actions.length === 0) && (
        <div className="text-sm text-slate-500">Add a few vacancies — and personalized priorities for the week will show up here.</div>
      )}
      {data?.offline && (
        <div className="text-xs text-slate-400 mt-2">Basic tips (AI offline). Set a key in server/.env for personalized analysis.</div>
      )}
    </Card>
  );
}
export function Dashboard({ go }: { go: (t: string) => void }) {
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
    toast(
      ok ? "Reminders enabled — we'll check for overdue steps next time you open the app" : "Notification permission was not granted",
      ok ? "success" : "error",
    );
  };
  const onDisableNotifications = () => {
    disableNotifications();
    setNotifOn(false);
    toast("Reminders disabled", "success");
  };
  if (loadingVacancies) return <CardsSkeleton count={4} />;
  const active = vacancies.filter((x) => !["Rejected", "Paused", "Want to apply"].includes(x.status)).length;
  const iv = vacancies.filter((x) => ["Tech interview", "Take-home task", "Final"].includes(x.status)).length;
  const upcoming = vacancies
    .filter((x) => x.next)
    .sort((a, b) => (a.next > b.next ? 1 : -1))
    .slice(0, 5);
  const stat = (n: string | number, l: string, c = "text-slate-900") => (
    <Card className="text-center">
      <div className={`text-3xl font-extrabold ${c}`}>{n}</div>
      <div className="text-xs text-slate-500 mt-1">{l}</div>
    </Card>
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle="Your job-search HQ: vacancy progress, upcoming steps, and quick access to everything."
        actions={profile?.domain ? <Chip tone="indigo">🎯 {profile.domain}</Chip> : undefined}
      />

      {vacancies.length <= 1 && (
        <Card className="!bg-indigo-50 !border-indigo-200">
          <div className="font-semibold text-indigo-900">👋 Getting started</div>
          <ol className="text-sm text-indigo-900/80 mt-2 space-y-1 list-decimal pl-5">
            <li>Add a few vacancies or import them on the "Vacancies" tab.</li>
            <li>Click "Analyze all" — the app will detect each vacancy's stack itself.</li>
            <li>Check the "Roadmap" and "Skill radar" — they'll show what to pick up for the market.</li>
          </ol>
          <div className="flex gap-2 mt-3">
            <Btn size="sm" onClick={() => go("vacancies")}>
              Add vacancies
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => go("roadmap")}>
              Open the roadmap
            </Btn>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stat(vacancies.length, "Total vacancies")}
        {stat(active, "Active", "text-indigo-600")}
        {stat(iv, "In interviews", "text-amber-600")}
        {stat(`${study?.learned ?? 0}/${study?.total ?? 0}`, "Cards learned", "text-emerald-600")}
      </div>

      {vacancies.length > 0 && <FocusWeekCard llm={llm} />}

      {roadmap && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-800">🗺️ Roadmap progress</div>
            <button onClick={() => go("roadmap")} className="text-sm text-indigo-600 hover:underline">
              Open →
            </button>
          </div>
          <ProgressBar value={roadmap.progress.done} max={roadmap.progress.total} tone="emerald" />
          <div className="text-xs text-slate-500 mt-2">
            Mastered {roadmap.progress.done} of {roadmap.progress.total} skills
            {learn && learn.gaps.length > 0 && (
              <>
                {" "}
                · top-priority gap: <b className="text-slate-700">{learn.gaps[0].tech}</b>
              </>
            )}
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-800">📅 Upcoming steps</div>
            {notificationsSupported() &&
              (notifOn ? (
                <button
                  onClick={onDisableNotifications}
                  title="Disable reminders"
                  className="text-[11px] text-emerald-600 hover:text-rose-600 hover:underline"
                >
                  🔔 Reminders enabled (turn off)
                </button>
              ) : (
                <button onClick={onEnableNotifications} className="text-[11px] text-indigo-600 hover:underline">
                  🔔 Enable reminders
                </button>
              ))}
          </div>
          {upcoming.length === 0 ? (
            <div className="text-slate-400 text-sm">Nothing scheduled — add a "next step" date on your vacancies.</div>
          ) : (
            upcoming.map((u) => (
              <div key={u.id} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                <span>
                  {u.company} — <span className="text-slate-500">{u.status}</span>
                </span>
                <span className="text-amber-600 font-medium">{u.next}</span>
              </div>
            ))
          )}
        </Card>
        <Card>
          <div className="font-semibold mb-2 text-slate-800">⚡ Quick actions</div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => go("analyzer")}>🔍 Vacancy analysis</Btn>
            <Btn variant="ghost" onClick={() => go("roadmap")}>
              🗺️ Roadmap
            </Btn>
            <Btn variant="ghost" onClick={() => go("study")}>
              🧠 Review
            </Btn>
            <Btn variant="ghost" onClick={() => go("cv")}>
              📄 CV analysis
            </Btn>
          </div>
          <div className="text-xs text-slate-400 mt-3">
            Cards due for review today: <b className="text-slate-600">{study?.due.length ?? 0}</b>
          </div>
        </Card>
      </div>
    </div>
  );
}
