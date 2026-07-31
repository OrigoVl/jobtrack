import { useEffect, useMemo, useState } from "react";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useHealth, useStudy } from "../../shared/queries";
import { Btn, Card, Chip, EmptyState, PageHeader } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import { plural } from "../../shared/format";
import type { MockEvaluation } from "../../shared/types";

/* ---------- Mock interview ---------- */
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
      <div className="mt-3 text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg p-2.5">
        {ev.verdict || "AI is unavailable for evaluation."}
      </div>
    );
  }
  const bar = ev.score >= 75 ? "bg-signal" : ev.score >= 50 ? "bg-alert" : "bg-rose-500";
  return (
    <div className="mt-3 rounded-lg border border-grid p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-extrabold text-ink">{ev.score}</span>
        <span className="text-xs text-ink-dim">/ 100</span>
        {ev.verdict && (
          <span className="text-sm text-ink-dim ml-1">
            <Markdown text={ev.verdict} inline />
          </span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${ev.score}%` }} />
      </div>
      {ev.good && ev.good.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-signal">✓ Strengths</div>
          <ul className="list-disc pl-5 text-sm text-ink">
            {ev.good.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      {ev.missed && ev.missed.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-rose-600">△ What was missed</div>
          <ul className="list-disc pl-5 text-sm text-ink">
            {ev.missed.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {ev.tip && (
        <div className="text-sm text-signal bg-signal/10 border border-signal/20 rounded p-2">
          💡 <Markdown text={ev.tip} inline />
        </div>
      )}
    </div>
  );
}
// `embedded` skips the page's own header — used when nested as a tab inside the Practice page
// (see study.tsx), which already has its own header/tab-switcher for the combined "Practice /
// Mock interview" screen.
export function MockInterview({ embedded = false }: { embedded?: boolean } = {}) {
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
  const header = embedded ? null : (
    <PageHeader
      title="Mock interview"
      subtitle="An interview simulation: a random selection of questions and problems with a timer. Say your answer out loud, then check yourself."
    />
  );
  if (!session) {
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <EmptyState
            icon="🎤"
            title="Ready for a practice interview?"
            hint={`We'll give you a random selection from ${plural(pool.length, "question")} and problems. Answer out loud, keep the pace, and get a summary at the end.`}
            action={
              <div className="flex items-center gap-2 justify-center flex-wrap">
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="text-sm border border-grid rounded-lg px-3 py-2 bg-white text-ink"
                >
                  {[5, 8, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} questions
                    </option>
                  ))}
                </select>
                <Btn onClick={start} disabled={pool.length === 0}>
                  ▶ Start
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
            title="Interview finished!"
            hint={`You went through ${plural(session.length, "question")}. The best way to reinforce this is to review the weak topics in "Practice".`}
            action={<Btn onClick={() => setSession(null)}>🔄 New session</Btn>}
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
      setEvaluation({ score: null, verdict: "Couldn't evaluate — try again." });
    } finally {
      setEvaluating(false);
    }
  };
  return (
    <div className="space-y-4">
      {header}
      <div className="flex items-center gap-3 text-xs text-ink-dim">
        <span>
          Question {idx + 1} / {session.length}
        </span>
        <span>⏱ {fmt(sec)}</span>
        <Btn size="sm" variant="subtle" className="ml-auto" onClick={() => setSession(null)}>
          Finish
        </Btn>
      </div>
      <Card className="min-h-[240px] flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-signal font-bold">{item.cat}</span>
          <Chip>{item.type === "card" ? "question" : "problem"}</Chip>
        </div>
        <div className="text-lg font-semibold mt-2 text-ink">{item.q}</div>
        <div className="mt-3">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            aria-label="Your answer to the question"
            placeholder="Write your answer — AI will evaluate it and give feedback…"
            className="w-full h-24 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <div className="flex gap-2 mt-2 items-center">
            <Btn size="sm" variant="ghost" onClick={evaluate} loading={evaluating} disabled={!answer.trim()}>
              ✨ Evaluate answer (AI)
            </Btn>
            {!llm && <span className="text-xs text-ink-dim">AI offline — set a key in server/.env</span>}
          </div>
          {evaluation && <MockEvalCard ev={evaluation} />}
        </div>
        {revealed && (
          <pre className="mt-3 bg-surface-2 border border-grid rounded-lg p-3 text-xs md:text-sm overflow-auto text-ink whitespace-pre-wrap">
            {item.a}
          </pre>
        )}
        <div className="mt-auto pt-4 flex flex-wrap gap-2">
          {!revealed ? (
            <Btn onClick={() => setRevealed(true)}>👁 Show answer</Btn>
          ) : (
            <Btn
              onClick={() => {
                setIdx(idx + 1);
                setRevealed(false);
              }}
            >
              {idx + 1 < session.length ? "Next →" : "Finish 🏁"}
            </Btn>
          )}
        </div>
      </Card>
    </div>
  );
}
