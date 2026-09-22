import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useHealth, useStudy } from "../../shared/queries";
import { Btn, Card, Chip, EmptyState, PageHeader, Segmented, Select } from "../../shared/ui";
import { MockEvalCard } from "./mock-eval-card";
import { VoiceInterview } from "./voice-interview";
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
// The original static, fully-offline-capable practice flow (sample from the user's own due
// flashcards/drills, type an answer, get it scored once) — now the "pool" sub-mode of Mock
// Interview, unchanged, sitting alongside the newer live voice interview (see VoiceInterview).
function PoolInterview({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation("mock");
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
    const timer = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
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
  const header = embedded ? null : <PageHeader title={t("title")} subtitle={t("subtitle")} />;
  if (!session) {
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <EmptyState
            title={t("start.title")}
            hint={t("start.hint", { count: pool.length })}
            action={
              <div className="flex items-center gap-2 justify-center flex-wrap">
                <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  {[5, 8, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {t("start.questionsOption", { count: n })}
                    </option>
                  ))}
                </Select>
                <Btn onClick={start} disabled={pool.length === 0}>
                  {t("start.startButton")}
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
            title={t("finished.title")}
            hint={t("finished.hint", { count: session.length })}
            action={<Btn onClick={() => setSession(null)}>{t("finished.newSession")}</Btn>}
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
      setEvaluation({ score: null, verdict: t("answer.evaluateFailed") });
    } finally {
      setEvaluating(false);
    }
  };
  return (
    <div className="space-y-4">
      {header}
      <div className="flex items-center gap-3 text-xs text-ink-dim">
        <span>{t("progress", { current: idx + 1, total: session.length })}</span>
        <span className="font-mono">{fmt(sec)}</span>
        <Btn size="sm" variant="subtle" className="ml-auto" onClick={() => setSession(null)}>
          {t("finish")}
        </Btn>
      </div>
      <Card className="min-h-[240px] flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-signal font-bold">{item.cat}</span>
          <Chip>{item.type === "card" ? t("type.card") : t("type.drill")}</Chip>
        </div>
        <div className="text-lg font-semibold mt-2 text-ink">{item.q}</div>
        <div className="mt-3">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            aria-label={t("answer.ariaLabel")}
            placeholder={t("answer.placeholder")}
            className="w-full h-24 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <div className="flex gap-2 mt-2 items-center">
            <Btn size="sm" variant="ghost" onClick={evaluate} loading={evaluating} disabled={!answer.trim()}>
              {t("answer.evaluate")}
            </Btn>
            {!llm && <span className="text-xs text-ink-dim">{t("answer.aiOffline")}</span>}
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
            <Btn onClick={() => setRevealed(true)}>{t("showAnswer")}</Btn>
          ) : (
            <Btn
              onClick={() => {
                setIdx(idx + 1);
                setRevealed(false);
              }}
            >
              {idx + 1 < session.length ? t("next") : t("finishSession")}
            </Btn>
          )}
        </div>
      </Card>
    </div>
  );
}

// `embedded` skips the page's own header — used when nested as a tab inside the Practice page
// (see study.tsx), which already has its own header/tab-switcher for the combined "Practice /
// Mock interview" screen. Owns the header (when not embedded) and the pool/live sub-mode toggle
// for BOTH inner components — they're always rendered with embedded=true so neither renders its
// own header on top of this one.
export function MockInterview({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation("mock");
  const [sub, setSub] = useUi<"pool" | "live">("mock.subMode", "pool");
  return (
    <div className="space-y-4">
      {embedded ? (
        // Nested inside Practice (study.tsx) with no header of its own until now — switching to
        // this mode gave zero indication of what it even was, unlike the srs/drill modes (which
        // at least show a "due today"/"solved" stat line). Matches LearnPlan/Plan21/SkillRadar's
        // own embedded subtitle line.
        <p className="text-sm text-ink-dim">{t("subtitle")}</p>
      ) : (
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      )}
      <div className="flex justify-end">
        <Segmented
          size="sm"
          value={sub}
          onChange={setSub}
          options={[
            { value: "pool", label: t("subMode.pool") },
            { value: "live", label: t("subMode.live") },
          ]}
        />
      </div>
      {sub === "live" ? <VoiceInterview /> : <PoolInterview embedded />}
    </div>
  );
}
