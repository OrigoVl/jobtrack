import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import { useStore } from "../../shared/store";
import { Btn, Card, Chip, PageHeader, ProgressBar } from "../../shared/ui";
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
        <span className="font-semibold text-indigo-900">🎯 Фокус тижня</span>
        {data && !data.offline && llm && <Chip tone="indigo">AI</Chip>}
      </div>
      {loading && <div className="text-sm text-slate-400">✨ Аналізую твій стан пошуку…</div>}
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
        <div className="text-sm text-slate-500">Додай кілька вакансій — і тут зʼявляться персональні пріоритети на тиждень.</div>
      )}
      {data?.offline && (
        <div className="text-xs text-slate-400 mt-2">Базові поради (AI офлайн). Увімкни ключ у server/.env для персонального аналізу.</div>
      )}
    </Card>
  );
}
export function Dashboard({ go }: { go: (t: string) => void }) {
  const { vacancies, study, roadmap, learn, llm, profile } = useStore();
  const active = vacancies.filter((x) => !["Відмова", "Пауза", "Хочу подати"].includes(x.status)).length;
  const iv = vacancies.filter((x) => ["Тех.співбесіда", "Тестове завдання", "Фінал"].includes(x.status)).length;
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
        title="Дашборд"
        subtitle="Твій штаб пошуку роботи: прогрес по вакансіях, найближчі кроки й швидкий доступ до всього."
        actions={profile?.domain ? <Chip tone="indigo">🎯 {profile.domain}</Chip> : undefined}
      />

      {vacancies.length <= 1 && (
        <Card className="!bg-indigo-50 !border-indigo-200">
          <div className="font-semibold text-indigo-900">👋 З чого почати</div>
          <ol className="text-sm text-indigo-900/80 mt-2 space-y-1 list-decimal pl-5">
            <li>Додай кілька вакансій або імпортуй їх на вкладці «Вакансії».</li>
            <li>Натисни «Спарсити всі» — застосунок сам визначить стек кожної вакансії.</li>
            <li>Дивись «Роудмапу» та «Skill-radar» — вони покажуть, що підтягнути під ринок.</li>
          </ol>
          <div className="flex gap-2 mt-3">
            <Btn size="sm" onClick={() => go("vacancies")}>
              Додати вакансії
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => go("roadmap")}>
              Відкрити роудмапу
            </Btn>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stat(vacancies.length, "Усього вакансій")}
        {stat(active, "Активні", "text-indigo-600")}
        {stat(iv, "На співбесідах", "text-amber-600")}
        {stat(`${study?.learned ?? 0}/${study?.total ?? 0}`, "Карток вивчено", "text-emerald-600")}
      </div>

      {vacancies.length > 0 && <FocusWeekCard llm={llm} />}

      {roadmap && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-800">🗺️ Прогрес роудмапи</div>
            <button onClick={() => go("roadmap")} className="text-sm text-indigo-600 hover:underline">
              Відкрити →
            </button>
          </div>
          <ProgressBar value={roadmap.progress.done} max={roadmap.progress.total} tone="emerald" />
          <div className="text-xs text-slate-500 mt-2">
            Опановано {roadmap.progress.done} із {roadmap.progress.total} навичок
            {learn && learn.gaps.length > 0 && (
              <>
                {" "}
                · пріоритетна прогалина: <b className="text-slate-700">{learn.gaps[0].tech}</b>
              </>
            )}
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="font-semibold mb-2 text-slate-800">📅 Найближчі кроки</div>
          {upcoming.length === 0 ? (
            <div className="text-slate-400 text-sm">Немає запланованих — додай дату «наступний крок» у вакансіях.</div>
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
          <div className="font-semibold mb-2 text-slate-800">⚡ Швидкі дії</div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => go("analyzer")}>🔍 Аналіз вакансії</Btn>
            <Btn variant="ghost" onClick={() => go("roadmap")}>
              🗺️ Роудмапа
            </Btn>
            <Btn variant="ghost" onClick={() => go("study")}>
              🧠 Повторення
            </Btn>
            <Btn variant="ghost" onClick={() => go("cv")}>
              📄 Аналіз CV
            </Btn>
          </div>
          <div className="text-xs text-slate-400 mt-3">
            Карток до повторення сьогодні: <b className="text-slate-600">{study?.due.length ?? 0}</b>
          </div>
        </Card>
      </div>
    </div>
  );
}
