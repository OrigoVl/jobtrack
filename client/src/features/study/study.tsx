import { useEffect, useMemo, useState } from "react";
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
import type { Drill } from "../../shared/types";

const RUNNABLE_CATS = new Set(["JavaScript", "Algorithms"]);

/* ---------- Study ---------- */
function DrillSandbox({ drill }: { drill: Drill }) {
  const starter = useMemo(() => `${drill.sol}\n\n// Виклич функцію і виведи результат: console.log(...)\n`, [drill.sol]);
  const [code, setCode] = useState(starter);
  const [result, setResult] = useState<{ logs: string[]; error: string | null; ms: number } | null>(null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-sm text-indigo-600 font-medium hover:underline self-start">
        🧪 Відкрити пісочницю (запустити код)
      </button>
    );
  }
  return (
    <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-500">🧪 Пісочниця JS</span>
        <div className="ml-auto flex gap-1">
          <Btn size="sm" onClick={() => setResult(runJs(code))}>
            ▶ Запустити
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => {
              setCode(starter);
              setResult(null);
            }}
          >
            Скинути
          </Btn>
        </div>
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={Math.min(16, code.split("\n").length + 1)}
        className="w-full font-mono text-xs p-3 outline-none resize-y text-slate-800"
      />
      {result && (
        <div className="border-t border-slate-200 px-3 py-2 text-xs font-mono bg-slate-900 text-slate-100">
          {result.error ? (
            <div className="text-rose-400 whitespace-pre-wrap">⛔ {result.error}</div>
          ) : result.logs.length ? (
            result.logs.map((l, idx) => (
              <div key={idx} className="whitespace-pre-wrap">
                {l}
              </div>
            ))
          ) : (
            <div className="text-slate-400">Готово (немає console.log). Час: {result.ms} мс</div>
          )}
          {!result.error && result.logs.length > 0 && <div className="text-slate-500 mt-1">⏱ {result.ms} мс</div>}
        </div>
      )}
    </div>
  );
}
export function Study() {
  const { data: study } = useStudy();
  const { data: learn } = useLearn();
  const { data: health } = useHealth();
  const { data: profile } = useProfile();
  const llm = health?.llm ?? false;
  const gradeCardMutation = useGradeCard();
  const setDrillStatusMutation = useSetDrillStatus();
  const generateDrillsMutation = useGenerateDrills();
  const generateCardsMutation = useGenerateCards();
  const [mode, setMode] = useUi<"srs" | "drill">("study.mode", "srs");
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
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
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
        setHints(res.offline || res.hints.length === 0 ? ["AI офлайн — увімкни ключ у server/.env для підказок."] : res.hints);
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
        title="Тренування"
        subtitle="Розумні флеш-картки з інтервальним повторенням (як в Anki) + drill-режим із практичними задачами."
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
              🃏 Флеш-картки
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
              ⌨️ Drill
            </Btn>
          </div>
        }
      />
      <div className="text-xs text-slate-400 flex gap-4 items-center">
        <span>
          ⏱ {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
        </span>
        {mode === "srs" && <span>До повторення сьогодні: {due.length}</span>}
        {mode === "drill" && (
          <span>
            Розвʼязано: {solvedCount} / {drills.length}
          </span>
        )}
        {mode === "srs" && cardTopic && (
          <Btn
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={onGenerateCards}
            disabled={generatingCards || !llm}
            title={llm ? "" : "Потрібен LLM-ключ"}
          >
            {generatingCards ? "⏳ Генерую…" : `✨ Ще картки під «${cardTopic}»`}
          </Btn>
        )}
      </div>

      {mode === "srs" &&
        (card ? (
          <Card className="min-h-[220px] flex flex-col">
            <div className="text-xs uppercase tracking-wide text-indigo-600 font-bold">{card.cat}</div>
            <div className="text-lg font-semibold mt-2 text-slate-800">{card.q}</div>
            {show && <div className="mt-3 pt-3 border-t border-slate-100 text-slate-700">{card.a}</div>}
            <div className="mt-auto pt-4 flex gap-2">
              {!show ? (
                <Btn onClick={() => setShow(true)}>👁 Показати відповідь</Btn>
              ) : (
                <>
                  <Btn variant="ghost" className="!bg-amber-50 !text-amber-700 !border-amber-200" onClick={() => grade(0)}>
                    🔁 Повторити
                  </Btn>
                  <Btn variant="ghost" className="!bg-emerald-50 !text-emerald-700 !border-emerald-200" onClick={() => grade(1)}>
                    ✅ Знаю
                  </Btn>
                </>
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon="🎉"
              title="Усі картки на сьогодні пройдено!"
              hint="Повертайся завтра — інтервали розраховані автоматично за алгоритмом SRS."
            />
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
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
            >
              {cats.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "Усі теми" : c}
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
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
            >
              <option value="all">Будь-яка складність</option>
              <option value="easy">easy</option>
              <option value="med">medium</option>
              <option value="hard">hard</option>
            </select>
            <label className="text-sm text-slate-600 flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyUnsolved}
                onChange={(e) => {
                  setOnlyUnsolved(e.target.checked);
                  setI(0);
                  setShow(false);
                }}
              />
              лише непройдені
            </label>
            <div className="ml-auto flex items-center gap-2">
              {genTech && (
                <Btn size="sm" variant="ghost" onClick={onGenerate} disabled={generating || !llm} title={llm ? "" : "Потрібен LLM-ключ"}>
                  {generating ? "⏳ Генерую…" : `✨ Ще задачі під «${genTech}»`}
                </Btn>
              )}
              <span className="text-xs text-slate-400">{filteredDrills.length} задач</span>
            </div>
          </div>
          {drill ? (
            <Card className="min-h-[220px] flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-indigo-600 font-bold">{drill.cat}</span>
                <Chip>{drill.lvl}</Chip>
                {drill.generated && <Chip tone="indigo">✨ AI під тебе</Chip>}
                {drillProgress[drill.id] === "solved" && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    ✓ розвʼязано
                  </span>
                )}
                <span className="text-xs text-slate-400 ml-auto">
                  {drillIdx + 1} / {filteredDrills.length}
                </span>
              </div>
              <div className="text-lg font-semibold mt-2 text-slate-800">{drill.q}</div>
              {hintsShown > 0 && (
                <div className="mt-3 space-y-1.5">
                  {hints.slice(0, hintsShown).map((h, idx) => (
                    <div
                      key={`${drill.id}-hint-${idx}`}
                      className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5"
                    >
                      💡 <b>Підказка {idx + 1}:</b> {h}
                    </div>
                  ))}
                </div>
              )}
              {show && (
                <>
                  <pre className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs overflow-auto text-slate-700">
                    {drill.sol}
                  </pre>
                  <div className="text-sm text-slate-500 mt-2">{drill.exp}</div>
                </>
              )}
              {RUNNABLE_CATS.has(drill.cat) && <DrillSandbox key={drill.id} drill={drill} />}
              <div className="mt-auto pt-4 flex flex-wrap gap-2">
                {!show && <Btn onClick={() => setShow(true)}>👁 Показати розвʼязок</Btn>}
                {!show && (
                  <Btn variant="ghost" onClick={revealHint} disabled={loadingHint || (hints.length > 0 && hintsShown >= hints.length)}>
                    {loadingHint
                      ? "⏳…"
                      : hintsShown === 0
                        ? "💡 Підказка"
                        : hintsShown < hints.length
                          ? "💡 Ще підказка"
                          : "💡 Підказки вичерпано"}
                  </Btn>
                )}
                {drillProgress[drill.id] === "solved" ? (
                  <Btn variant="ghost" onClick={() => setDrillStatusMutation.mutate({ id: drill.id, status: "todo" })}>
                    ↩︎ Скинути
                  </Btn>
                ) : (
                  <Btn
                    variant="ghost"
                    className="!bg-emerald-50 !text-emerald-700 !border-emerald-200"
                    onClick={() => setDrillStatusMutation.mutate({ id: drill.id, status: "solved" })}
                  >
                    ✅ Зроблено
                  </Btn>
                )}
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setI(i - 1);
                    setShow(false);
                  }}
                >
                  ← Попередня
                </Btn>
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setI(i + 1);
                    setShow(false);
                  }}
                >
                  Наступна →
                </Btn>
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon="🔍"
                title="Немає задач за цим фільтром"
                hint="Спробуй іншу тему, складність або вимкни «лише непройдені»."
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
