import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useAddVacancy, useFetchAllVacancies } from "../../shared/queries";
import { Btn, Card, Chip, PageHeader } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import type { AnalyzeResult, Fit, FetchAllResult } from "../../shared/types";
import { fitText } from "../../shared/fit-tone";

/* ---------- Analyzer ---------- */
export function Analyzer() {
  const { t } = useTranslation(["analyzer", "common"]);
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
      /* toast lives in the store for mutations; this analysis doesn't use a mutation */
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
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card>
        <div className="text-sm font-semibold mb-1 text-ink">{t("autoParse.heading")}</div>
        <p className="text-xs text-ink-dim mb-2">{t("autoParse.description")}</p>
        <Btn onClick={fetchAll} loading={batchBusy}>
          {batchBusy ? t("autoParse.analyzing") : t("autoParse.button")}
        </Btn>
        {batch && (
          <div className="mt-3 text-sm">
            <div className="text-ink-dim mb-2">
              {t("autoParse.processed")} <b>{batch.processed}</b>
            </div>
            <div className="space-y-1 max-h-64 overflow-auto">
              {batch.results.map((r) => (
                <div key={r.id} className="flex gap-2 items-start border-b border-surface-2 pb-1">
                  <span className="font-medium w-28 shrink-0 truncate">{r.company}</span>
                  {r.error ? (
                    <span className="text-rose-600 text-xs">{r.error}</span>
                  ) : (
                    <span className="text-xs text-ink-dim">
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
          aria-label={t("textarea.ariaLabel")}
          placeholder={t("textarea.placeholder")}
          className="w-full h-40 bg-surface-2 border border-grid rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
        />
        <Btn className="mt-2" onClick={run} loading={busy} disabled={!text}>
          {busy ? t("textarea.analyzing") : t("textarea.analyze")}
        </Btn>
      </Card>

      {res && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-ink-dim">{t("result.fit")}</span>
            <span className={"font-bold " + fitText[res.fit]}>{res.fit.toUpperCase()}</span>
            {res.level && <Chip>{res.level}</Chip>}
            {res.semanticFit != null && (
              <Chip tone={res.semanticFit >= 0.75 ? "emerald" : res.semanticFit >= 0.5 ? "amber" : "rose"}>
                {t("result.semanticFit", { percent: Math.round(res.semanticFit * 100) })}
              </Chip>
            )}
          </div>
          <div>
            <div className="text-xs text-ink-dim mb-1">{t("result.match")}</div>
            <div className="flex flex-wrap gap-1">
              {res.match.length ? (
                res.match.map((m) => (
                  <Chip key={m} tone="emerald">
                    {m}
                  </Chip>
                ))
              ) : (
                <span className="text-ink-dim text-sm">—</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-dim mb-1">{t("result.gaps")}</div>
            <div className="flex flex-wrap gap-1">
              {res.gap.length ? (
                res.gap.map((g) => (
                  <Chip key={g} tone="rose">
                    {g}
                  </Chip>
                ))
              ) : (
                <span className="text-ink-dim text-sm">{t("result.noGaps")}</span>
              )}
            </div>
          </div>
          {res.summary && (
            <div className="border-t border-surface-2 pt-3">
              <div className="text-xs text-ink-dim mb-1">{t("result.aiSummary")}</div>
              <Markdown text={res.summary} />
            </div>
          )}
          <Btn
            variant="ghost"
            loading={addVacancyMutation.isPending}
            onClick={() =>
              addVacancyMutation.mutate({ company: "From analysis", position: "", stack: res.techs, fit: res.fit, level: res.level })
            }
          >
            {t("result.addToTracker")}
          </Btn>
        </Card>
      )}
    </div>
  );
}
