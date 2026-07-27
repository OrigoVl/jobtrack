import { useState } from "react";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useAddVacancy, useFetchAllVacancies } from "../../shared/queries";
import { Btn, Card, Chip, PageHeader } from "../../shared/ui";
import type { AnalyzeResult, Fit, FetchAllResult } from "../../shared/types";
import { fitText } from "../../shared/fit-tone";

/* ---------- Analyzer ---------- */
export function Analyzer() {
  const addVacancyMutation = useAddVacancy();
  const fetchAllVacanciesMutation = useFetchAllVacancies();
  const [text, setText] = useUi("analyzer.text", "");
  const [res, setRes] = useUi<AnalyzeResult | null>("analyzer.res", null);
  const [batch, setBatch] = useUi<FetchAllResult | null>("analyzer.batch", null);
  const [busy, setBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      setRes(await api.analyzeVacancy(text));
    } catch {
      /* toast у store для мутацій; тут аналіз без мутації */
    } finally {
      setBusy(false);
    }
  };
  const fetchAll = async () => {
    setBatchBusy(true);
    setBatch(null);
    try {
      setBatch(await fetchAllVacanciesMutation.mutateAsync());
    } finally {
      setBatchBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="Аналіз вакансії"
        subtitle="Встав текст вакансії — визначу стек, рівень і прогалини під твій профіль. Додані/спарсені навички одразу підуть у радар, роудмапу й аналітику."
      />

      <Card>
        <div className="text-sm font-semibold mb-1 text-slate-700">🔗 Автопарсинг за посиланнями</div>
        <p className="text-xs text-slate-500 mb-2">
          Пройдеться по всіх доданих вакансіях, завантажить текст за посиланням і оновить стек/рівень/fit. Дані миттєво зʼявляться у
          Skill-radar, Аналітиці та Роудмапі.
        </p>
        <Btn onClick={fetchAll} loading={batchBusy}>
          {batchBusy ? "Парсю всі вакансії…" : "🔗 Спарсити й проаналізувати всі вакансії"}
        </Btn>
        {batch && (
          <div className="mt-3 text-sm">
            <div className="text-slate-600 mb-2">
              Оброблено: <b>{batch.processed}</b>
            </div>
            <div className="space-y-1 max-h-64 overflow-auto">
              {batch.results.map((r) => (
                <div key={r.id} className="flex gap-2 items-start border-b border-slate-100 pb-1">
                  <span className="font-medium w-28 shrink-0 truncate">{r.company}</span>
                  {r.error ? (
                    <span className="text-rose-600 text-xs">{r.error}</span>
                  ) : (
                    <span className="text-xs text-slate-500">
                      {(r.techs || []).join(", ")} <span className={"ml-1 " + fitText[(r.fit as Fit) || "med"]}>· {r.fit}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Текст вакансії для аналізу"
          placeholder="Встав текст вакансії…"
          className="w-full h-40 bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <Btn className="mt-2" onClick={run} loading={busy} disabled={!text}>
          {busy ? "Аналізую…" : "Проаналізувати"}
        </Btn>
      </Card>

      {res && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-500">Fit:</span>
            <span className={"font-bold " + fitText[res.fit]}>{res.fit.toUpperCase()}</span>
            {res.level && <Chip>{res.level}</Chip>}
            {res.semanticFit != null && (
              <Chip tone={res.semanticFit >= 0.75 ? "emerald" : res.semanticFit >= 0.5 ? "amber" : "rose"}>
                🧠 Семантична схожість з CV: {Math.round(res.semanticFit * 100)}%
              </Chip>
            )}
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">✅ Збіг із твоїм стеком</div>
            <div className="flex flex-wrap gap-1">
              {res.match.length ? (
                res.match.map((t) => (
                  <Chip key={t} tone="emerald">
                    {t}
                  </Chip>
                ))
              ) : (
                <span className="text-slate-400 text-sm">—</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">⚠️ Прогалини (що підтягнути)</div>
            <div className="flex flex-wrap gap-1">
              {res.gap.length ? (
                res.gap.map((t) => (
                  <Chip key={t} tone="rose">
                    {t}
                  </Chip>
                ))
              ) : (
                <span className="text-slate-400 text-sm">Немає — ти покриваєш стек!</span>
              )}
            </div>
          </div>
          {res.summary && <div className="text-sm text-slate-700 whitespace-pre-wrap border-t border-slate-100 pt-3">🤖 {res.summary}</div>}
          <Btn
            variant="ghost"
            loading={addVacancyMutation.isPending}
            onClick={() =>
              addVacancyMutation.mutate({ company: "З аналізу", position: "", stack: res.techs, fit: res.fit, level: res.level })
            }
          >
            + Додати цю вакансію у трекер
          </Btn>
        </Card>
      )}
    </div>
  );
}
