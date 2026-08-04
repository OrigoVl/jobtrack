import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import {
  useGenerateCards,
  useGenerateDrills,
  useGradeCard,
  useHealth,
  useLearn,
  useProfile,
  useSetDrillStatus,
  useStudy,
} from "../../shared/queries";
import { runJs } from "./runner";
import { Btn, Card, Chip, EmptyState, PageHeader } from "../../shared/ui";
import { MockInterview } from "../mock/mock";
import type { Drill } from "../../shared/types";

const RUNNABLE_CATS = new Set(["JavaScript", "Algorithms"]);

/* ---------- Study ---------- */
function DrillSandbox({ drill }: { drill: Drill }) {
  const { t } = useTranslation("study");
  const starter = useMemo(() => `${drill.sol}\n\n// Call the function and print the result: console.log(...)\n`, [drill.sol]);
  const [code, setCode] = useState(starter);
  const [result, setResult] = useState<{ logs: string[]; error: string | null; ms: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-sm text-signal font-medium hover:underline self-start">
        {t("sandbox.open")}
      </button>
    );
  }
  return (
    <div className="mt-3 border border-grid rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border-b border-grid">
        <span className="text-xs font-semibold text-ink-dim">{t("sandbox.title")}</span>
        <div className="ml-auto flex gap-1">
          <Btn
            size="sm"
            loading={running}
            onClick={async () => {
              setRunning(true);
              try {
                setResult(await runJs(code));
              } finally {
                setRunning(false);
              }
            }}
          >
            {t("sandbox.run")}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => {
              setCode(starter);
              setResult(null);
            }}
          >
            {t("sandbox.reset")}
          </Btn>
        </div>
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={Math.min(16, code.split("\n").length + 1)}
        className="w-full font-mono text-xs p-3 outline-none resize-y text-ink"
      />
      {result && (
        <div className="border-t border-grid px-3 py-2 text-xs font-mono bg-ink text-surface-2">
          {result.error ? (
            <div className="text-rose-400 whitespace-pre-wrap">⛔ {result.error}</div>
          ) : result.logs.length ? (
            result.logs.map((l, idx) => (
              <div key={idx} className="whitespace-pre-wrap">
                {l}
              </div>
            ))
          ) : (
            <div className="text-ink-dim">{t("sandbox.done", { ms: result.ms })}</div>
          )}
          {!result.error && result.logs.length > 0 && <div className="text-ink-dim mt-1">{t("sandbox.time", { ms: result.ms })}</div>}
        </div>
      )}
    </div>
  );
}
export function Study() {
  const { t } = useTranslation("study");
  const { data: study } = useStudy();
  const { data: learn } = useLearn();
  const { data: health } = useHealth();
  const { data: profile } = useProfile();
  const llm = health?.llm ?? false;
  const gradeCardMutation = useGradeCard();
  const setDrillStatusMutation = useSetDrillStatus();
  const generateDrillsMutation = useGenerateDrills();
  const generateCardsMutation = useGenerateCards();
  // "Mock interview" used to be its own sidebar page — merged in here as a third mode, so
  // interview-prep functionality (flashcards, drills, mock interview) lives in one place instead
  // of being scattered across the sidebar (see App.tsx's NAV — /mock now redirects here).
  const [mode, setMode] = useUi<"srs" | "drill" | "mock">("study.mode", "srs");
  const [i, setI] = useUi("study.index", 0);
  const [show, setShow] = useUi("study.show", false);
  const [drillCat, setDrillCat] = useUi("study.drillCat", "all");
  const [drillLvl, setDrillLvl] = useUi("study.drillLvl", "all");
  const [onlyUnsolved, setOnlyUnsolved] = useUi("study.drillUnsolved", false);
  const [sec, setSec] = useState(0);
  const [hints, setHints] = useState<string[]>([]);
  const [hintsShown, setHintsShown] = useState(0);
  const [loadingHint, setLoadingHint] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const due = study?.due ?? [];
  const drills = study?.drills ?? [];
  const drillProgress = study?.drillProgress ?? {};
  const solvedCount = drills.filter((d) => drillProgress[d.id] === "solved").length;
  const cats = ["all", ...Array.from(new Set(drills.map((d) => d.cat)))];
  const filteredDrills = drills.filter(
    (d) =>
      (drillCat === "all" || d.cat === drillCat) &&
      (drillLvl === "all" || d.lvl === drillLvl) &&
      (!onlyUnsolved || drillProgress[d.id] !== "solved"),
  );
  useEffect(() => {
    const timer = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [i, mode]);
  useEffect(() => {
    setSec(0);
  }, [i, mode]);
  const card = due[Math.min(i, Math.max(0, due.length - 1))];
  const drillIdx = filteredDrills.length ? ((i % filteredDrills.length) + filteredDrills.length) % filteredDrills.length : 0;
  const drill = filteredDrills[drillIdx];
  useEffect(() => {
    setHints([]);
    setHintsShown(0);
  }, [drill?.id]);
  const genTech = drillCat !== "all" ? drillCat : learn?.gaps?.[0]?.tech;
  const grade = async (g: number) => {
    if (!card) return;
    await gradeCardMutation.mutateAsync({ cardId: card.id, grade: g });
    setShow(false);
    setI(0);
  };
  const revealHint = async () => {
    if (!drill) return;
    if (hints.length === 0) {
      setLoadingHint(true);
      try {
        const res = await api.drillHint(drill.id);
        setHints(res.offline || res.hints.length === 0 ? [t("drill.hintsAiOffline")] : res.hints);
        setHintsShown(1);
      } finally {
        setLoadingHint(false);
      }
    } else {
      setHintsShown((n) => Math.min(n + 1, hints.length));
    }
  };
  const onGenerate = async () => {
    if (!genTech) return;
    setGenerating(true);
    try {
      await generateDrillsMutation.mutateAsync(genTech);
    } finally {
      setGenerating(false);
    }
  };
  const cardTopic = profile?.domain || learn?.gaps?.[0]?.tech;
  const onGenerateCards = async () => {
    if (!cardTopic) return;
    setGeneratingCards(true);
    try {
      await generateCardsMutation.mutateAsync(cardTopic);
    } finally {
      setGeneratingCards(false);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-1">
            <Btn
              variant={mode === "srs" ? "primary" : "ghost"}
              size="sm"
              onClick={() => {
                setMode("srs");
                setI(0);
                setShow(false);
              }}
            >
              {t("tabs.flashcards")}
            </Btn>
            <Btn
              variant={mode === "drill" ? "primary" : "ghost"}
              size="sm"
              onClick={() => {
                setMode("drill");
                setI(0);
                setShow(false);
              }}
            >
              {t("tabs.drill")}
            </Btn>
            <Btn variant={mode === "mock" ? "primary" : "ghost"} size="sm" onClick={() => setMode("mock")}>
              {t("tabs.mock")}
            </Btn>
          </div>
        }
      />
      {mode !== "mock" && (
        <div className="text-xs text-ink-dim flex gap-4 items-center">
          <span>
            ⏱ {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
          </span>
          {mode === "srs" && <span>{t("stats.dueToday", { count: due.length })}</span>}
          {mode === "drill" && <span>{t("stats.solved", { count: solvedCount, total: drills.length })}</span>}
          {mode === "srs" && cardTopic && (
            <Btn
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={onGenerateCards}
              loading={generatingCards}
              disabled={!llm}
              title={llm ? "" : t("llmKeyRequired")}
            >
              {t("moreCards", { topic: cardTopic })}
            </Btn>
          )}
        </div>
      )}

      {mode === "mock" && <MockInterview embedded />}

      {mode === "srs" &&
        (card ? (
          <Card className="min-h-[220px] flex flex-col">
            <div className="text-xs uppercase tracking-wide text-signal font-bold">{card.cat}</div>
            <div className="text-lg font-semibold mt-2 text-ink">{card.q}</div>
            {show && <div className="mt-3 pt-3 border-t border-surface-2 text-ink">{card.a}</div>}
            <div className="mt-auto pt-4 flex flex-wrap gap-2">
              {!show ? (
                <Btn onClick={() => setShow(true)}>{t("srs.showAnswer")}</Btn>
              ) : (
                <>
                  <Btn variant="ghost" className="!bg-rose-50 !text-rose-700 !border-rose-200" onClick={() => grade(1)}>
                    {t("srs.grade.again")}
                  </Btn>
                  <Btn variant="ghost" className="!bg-alert/10 !text-alert !border-alert/30" onClick={() => grade(2)}>
                    {t("srs.grade.hard")}
                  </Btn>
                  <Btn variant="ghost" className="!bg-signal/10 !text-signal !border-signal/30" onClick={() => grade(3)}>
                    {t("srs.grade.good")}
                  </Btn>
                  <Btn variant="ghost" className="!bg-sky-50 !text-sky-700 !border-sky-200" onClick={() => grade(4)}>
                    {t("srs.grade.easy")}
                  </Btn>
                </>
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState icon="🎉" title={t("srs.empty.title")} hint={t("srs.empty.hint")} />
          </Card>
        ))}

      {mode === "drill" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={drillCat}
              onChange={(e) => {
                setDrillCat(e.target.value);
                setI(0);
                setShow(false);
              }}
              className="text-sm border border-grid rounded-lg px-3 py-1.5 bg-white text-ink"
            >
              {cats.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? t("drill.allTopics") : c}
                </option>
              ))}
            </select>
            <select
              value={drillLvl}
              onChange={(e) => {
                setDrillLvl(e.target.value);
                setI(0);
                setShow(false);
              }}
              className="text-sm border border-grid rounded-lg px-3 py-1.5 bg-white text-ink"
            >
              <option value="all">{t("drill.difficulty.any")}</option>
              <option value="easy">{t("drill.difficulty.easy")}</option>
              <option value="med">{t("drill.difficulty.med")}</option>
              <option value="hard">{t("drill.difficulty.hard")}</option>
            </select>
            <label className="text-sm text-ink-dim flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyUnsolved}
                onChange={(e) => {
                  setOnlyUnsolved(e.target.checked);
                  setI(0);
                  setShow(false);
                }}
              />
              {t("drill.unsolvedOnly")}
            </label>
            <div className="ml-auto flex items-center gap-2">
              {genTech && (
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={onGenerate}
                  loading={generating}
                  disabled={!llm}
                  title={llm ? "" : t("llmKeyRequired")}
                >
                  {t("drill.moreProblems", { tech: genTech })}
                </Btn>
              )}
              <span className="text-xs text-ink-dim">{t("drill.problemsCount", { count: filteredDrills.length })}</span>
            </div>
          </div>
          {drill ? (
            <Card className="min-h-[220px] flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-signal font-bold">{drill.cat}</span>
                <Chip>{drill.lvl}</Chip>
                {drill.generated && <Chip tone="indigo">{t("drill.aiTailored")}</Chip>}
                {drillProgress[drill.id] === "solved" && (
                  <span className="text-xs font-semibold text-signal bg-signal/10 border border-signal/30 rounded-full px-2 py-0.5">
                    {t("drill.solvedBadge")}
                  </span>
                )}
                <span className="text-xs text-ink-dim ml-auto">
                  {drillIdx + 1} / {filteredDrills.length}
                </span>
              </div>
              <div className="text-lg font-semibold mt-2 text-ink">{drill.q}</div>
              {hintsShown > 0 && (
                <div className="mt-3 space-y-1.5">
                  {hints.slice(0, hintsShown).map((h, idx) => (
                    <div key={`${drill.id}-hint-${idx}`} className="text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg p-2.5">
                      💡 <b>{t("drill.hintLabel", { num: idx + 1 })}</b> {h}
                    </div>
                  ))}
                </div>
              )}
              {show && (
                <>
                  <pre className="mt-3 bg-surface-2 border border-grid rounded-lg p-3 text-xs overflow-auto text-ink">{drill.sol}</pre>
                  <div className="text-sm text-ink-dim mt-2">{drill.exp}</div>
                </>
              )}
              {RUNNABLE_CATS.has(drill.cat) && <DrillSandbox key={drill.id} drill={drill} />}
              <div className="mt-auto pt-4 flex flex-wrap gap-2">
                {!show && <Btn onClick={() => setShow(true)}>{t("drill.showSolution")}</Btn>}
                {!show && (
                  <Btn variant="ghost" onClick={revealHint} loading={loadingHint} disabled={hints.length > 0 && hintsShown >= hints.length}>
                    {hintsShown === 0
                      ? t("drill.hintButton.first")
                      : hintsShown < hints.length
                        ? t("drill.hintButton.another")
                        : t("drill.hintButton.none")}
                  </Btn>
                )}
                {drillProgress[drill.id] === "solved" ? (
                  <Btn variant="ghost" onClick={() => setDrillStatusMutation.mutate({ id: drill.id, status: "todo" })}>
                    {t("drill.reset")}
                  </Btn>
                ) : (
                  <Btn
                    variant="ghost"
                    className="!bg-signal/10 !text-signal !border-signal/30"
                    onClick={() => setDrillStatusMutation.mutate({ id: drill.id, status: "solved" })}
                  >
                    {t("drill.done")}
                  </Btn>
                )}
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setI(i - 1);
                    setShow(false);
                  }}
                >
                  {t("drill.previous")}
                </Btn>
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setI(i + 1);
                    setShow(false);
                  }}
                >
                  {t("drill.next")}
                </Btn>
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState icon="🔍" title={t("drill.empty.title")} hint={t("drill.empty.hint")} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
