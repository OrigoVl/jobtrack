import { useEffect, useMemo, useState } from "react";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useHealth, useStudy } from "../../shared/queries";
import { Btn, Card, Chip, EmptyState, PageHeader } from "../../shared/ui";
import type { MockEvaluation } from "../../shared/types";

/* ---------- Мок-інтерв'ю ---------- */
interface MockItem {
  type: "card" | "drill";
  q: string;
  a: string;
  cat: string;
}
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
function MockEvalCard({ ev }: { ev: MockEvaluation }) {
  if (ev.offline || ev.score === null) {
    return (
      <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
        {ev.verdict || "AI недоступний для оцінки."}
      </div>
    );
  }
  const bar = ev.score >= 75 ? "bg-emerald-500" : ev.score >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="mt-3 rounded-lg border border-slate-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-extrabold text-slate-800">{ev.score}</span>
        <span className="text-xs text-slate-400">/ 100</span>
        {ev.verdict && <span className="text-sm text-slate-600 ml-1">{ev.verdict}</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${ev.score}%` }} />
      </div>
      {ev.good && ev.good.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-emerald-600">✓ Сильні сторони</div>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {ev.good.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      {ev.missed && ev.missed.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-rose-600">△ Що пропущено</div>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {ev.missed.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {ev.tip && <div className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded p-2">💡 {ev.tip}</div>}
    </div>
  );
}
export function MockInterview() {
  const { data: study } = useStudy();
  const { data: health } = useHealth();
  const llm = health?.llm ?? false;
  const [session, setSession] = useUi<MockItem[] | null>("mock.session", null);
  const [idx, setIdx] = useUi("mock.idx", 0);
  const [revealed, setRevealed] = useUi("mock.revealed", false);
  const [count, setCount] = useUi("mock.count", 5);
  const [sec, setSec] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<MockEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [idx, session]);
  useEffect(() => {
    setSec(0);
    setAnswer("");
    setEvaluation(null);
  }, [idx]);
  const pool = useMemo<MockItem[]>(
    () => [
      ...(study?.due ?? []).map((c) => ({ type: "card" as const, q: c.q, a: c.a, cat: c.cat })),
      ...(study?.drills ?? []).map((d) => ({ type: "drill" as const, q: d.q, a: `${d.sol}\n\n${d.exp}`, cat: d.cat })),
    ],
    [study],
  );
  const start = () => {
    setSession(sample(pool, count));
    setIdx(0);
    setRevealed(false);
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const header = (
    <PageHeader
      title="Мок-інтерв'ю"
      subtitle="Симуляція співбесіди: випадкова добірка питань і задач із таймером. Проговорюй відповідь уголос, потім звіряйся."
    />
  );
  if (!session) {
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <EmptyState
            icon="🎤"
            title="Готовий до тренувального інтерв'ю?"
            hint={`Дамо випадкову добірку з ${pool.length} питань і задач. Відповідай уголос, тримай темп, наприкінці — підсумок.`}
            action={
              <div className="flex items-center gap-2 justify-center flex-wrap">
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700"
                >
                  {[5, 8, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} питань
                    </option>
                  ))}
                </select>
                <Btn onClick={start} disabled={pool.length === 0}>
                  ▶ Почати
                </Btn>
              </div>
            }
          />
        </Card>
      </div>
    );
  }
  if (idx >= session.length) {
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <EmptyState
            icon="🏁"
            title="Інтерв'ю завершено!"
            hint={`Ти пройшов ${session.length} питань. Найкраще закріплення — повторити слабкі теми у «Тренуванні».`}
            action={<Btn onClick={() => setSession(null)}>🔄 Нова сесія</Btn>}
          />
        </Card>
      </div>
    );
  }
  const item = session[idx];
  const evaluate = async () => {
    if (!answer.trim()) return;
    setEvaluating(true);
    try {
      setEvaluation(await api.evaluateMock(item.q, answer, item.a));
    } catch {
      setEvaluation({ score: null, verdict: "Не вдалося оцінити — спробуй ще раз." });
    } finally {
      setEvaluating(false);
    }
  };
  return (
    <div className="space-y-4">
      {header}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>
          Питання {idx + 1} / {session.length}
        </span>
        <span>⏱ {fmt(sec)}</span>
        <Btn size="sm" variant="subtle" className="ml-auto" onClick={() => setSession(null)}>
          Завершити
        </Btn>
      </div>
      <Card className="min-h-[240px] flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-indigo-600 font-bold">{item.cat}</span>
          <Chip>{item.type === "card" ? "питання" : "задача"}</Chip>
        </div>
        <div className="text-lg font-semibold mt-2 text-slate-800">{item.q}</div>
        <div className="mt-3">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            aria-label="Твоя відповідь на питання"
            placeholder="Напиши свою відповідь — AI її оцінить і дасть фідбек…"
            className="w-full h-24 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex gap-2 mt-2 items-center">
            <Btn size="sm" variant="ghost" onClick={evaluate} loading={evaluating} disabled={!answer.trim()}>
              ✨ Оцінити відповідь (AI)
            </Btn>
            {!llm && <span className="text-xs text-slate-400">AI офлайн — увімкни ключ у server/.env</span>}
          </div>
          {evaluation && <MockEvalCard ev={evaluation} />}
        </div>
        {revealed && (
          <pre className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs md:text-sm overflow-auto text-slate-700 whitespace-pre-wrap">
            {item.a}
          </pre>
        )}
        <div className="mt-auto pt-4 flex flex-wrap gap-2">
          {!revealed ? (
            <Btn onClick={() => setRevealed(true)}>👁 Показати відповідь</Btn>
          ) : (
            <Btn
              onClick={() => {
                setIdx(idx + 1);
                setRevealed(false);
              }}
            >
              {idx + 1 < session.length ? "Наступне →" : "Завершити 🏁"}
            </Btn>
          )}
        </div>
      </Card>
    </div>
  );
}
