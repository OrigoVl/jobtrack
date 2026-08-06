import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useAddVacancy, useFetchAllJobStatus, useStartFetchAllJob, useVacancies } from "../../shared/queries";
import { Btn, Card, Chip, PageHeader, ProgressBar } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import type { AnalyzeResult, Fit } from "../../shared/types";
import { fitText } from "../../shared/fit-tone";
import { VacancyDetailModal } from "../vacancies/vacancy-detail-modal";

/* ---------- Analyzer ---------- */
export function Analyzer() {
  const { t } = useTranslation(["analyzer", "common"]);
  const addVacancyMutation = useAddVacancy();
  const startFetchAllMutation = useStartFetchAllJob();
  // Polled globally (see shared/fetch-all-notifier.tsx, mounted once at the app shell) — this
  // page just reads whatever the shared job state currently is, so progress/results are visible
  // here regardless of whether THIS page or the notifier itself started the poll.
  const { data: job } = useFetchAllJobStatus();
  const { data: vacancies = [] } = useVacancies();
  const [text, setText] = useUi("analyzer.text", "");
  const [res, setRes] = useUi<AnalyzeResult | null>("analyzer.res", null);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailVacancyId, setDetailVacancyId] = useState<number | null>(null);
  const detailVacancy = detailVacancyId != null ? vacancies.find((v) => v.id === detailVacancyId) : undefined;

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

  const isRunning = job?.status === "running";

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

      <Card>
        <div className="text-sm font-semibold mb-1 text-ink">{t("autoParse.heading")}</div>
        <p className="text-xs text-ink-dim mb-2">{t("autoParse.description")}</p>
        <Btn onClick={() => startFetchAllMutation.mutate()} loading={startFetchAllMutation.isPending || isRunning} disabled={isRunning}>
          {isRunning ? t("autoParse.analyzing") : t("autoParse.button")}
        </Btn>
        {job && (
          <div className="mt-3">
            <div className="text-xs text-ink-dim mb-1">{t("autoParse.progress", { processed: job.processed, total: job.total })}</div>
            {isRunning && (
              <div className="mb-2">
                <ProgressBar value={job.processed} max={job.total} />
              </div>
            )}
            {job.status === "error" && <div className="text-rose-600 text-xs mb-2">{job.error || t("autoParse.errorGeneric")}</div>}
            {job.results.length > 0 && (
              <div className="space-y-1 max-h-64 overflow-auto text-sm">
                {job.results.map((r) => {
                  const expanded = expandedId === r.id;
                  const vacancy = vacancies.find((v) => v.id === r.id);
                  return (
                    <div key={r.id} className="border-b border-surface-2 pb-1.5">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                        aria-expanded={expanded}
                        className="w-full flex gap-2 items-start text-left py-0.5"
                      >
                        <span className="font-medium w-28 shrink-0 truncate">{r.company}</span>
                        {r.error ? (
                          <span className="text-rose-600 text-xs">{r.error}</span>
                        ) : (
                          <span className="text-xs text-ink-dim">
                            {(r.techs || []).join(", ")} <span className={"ml-1 " + fitText[(r.fit as Fit) || "med"]}>· {r.fit}</span>
                          </span>
                        )}
                      </button>
                      {expanded && !r.error && (
                        <div className="mt-1.5 space-y-2 pl-1">
                          {r.level && <Chip>{r.level}</Chip>}
                          <div>
                            <div className="text-[11px] text-ink-dim mb-0.5">{t("result.match")}</div>
                            <div className="flex flex-wrap gap-1">
                              {r.match?.length ? (
                                r.match.map((m) => (
                                  <Chip key={m} tone="emerald">
                                    {m}
                                  </Chip>
                                ))
                              ) : (
                                <span className="text-ink-dim text-xs">—</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-ink-dim mb-0.5">{t("result.gaps")}</div>
                            <div className="flex flex-wrap gap-1">
                              {r.gap?.length ? (
                                r.gap.map((g) => (
                                  <Chip key={g} tone="rose">
                                    {g}
                                  </Chip>
                                ))
                              ) : (
                                <span className="text-ink-dim text-xs">{t("result.noGaps")}</span>
                              )}
                            </div>
                          </div>
                          {vacancy && (
                            <Btn size="sm" variant="ghost" onClick={() => setDetailVacancyId(r.id)}>
                              {t("autoParse.viewDetails")}
                            </Btn>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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

      {detailVacancy && <VacancyDetailModal vacancy={detailVacancy} initialTab="fit" onClose={() => setDetailVacancyId(null)} />}
    </div>
  );
}
