import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUi } from "../../shared/ui-state";
import {
  useAddVacancy,
  useDeleteVacancy,
  useImportVacancies,
  useImportVacanciesJson,
  useUpdateVacancy,
  useVacancies,
} from "../../shared/queries";
import { api } from "../../shared/api";
import { useToast } from "../../shared/use-toast";
import { Btn, Card, CardsSkeleton, EmptyState, PageHeader, Spinner } from "../../shared/ui";
import { DateInput } from "../../shared/date-input";
import { STATUSES, type Fit, type VacancyStatus } from "../../shared/types";
import { fitText, fitLabel } from "../../shared/fit-tone";
import { statusLabel } from "../../shared/status-labels";
import { STATUS_SELECT_CLASS, DEFAULT_STATUS_SELECT_CLASS } from "../../shared/status-tone";
import { VacancyBoard } from "./kanban-board";
import { SimilarVacanciesButton } from "./similar-vacancies-button";

/** Triggers a browser download of a JSON file with the given data (for exporting vacancies). */
function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Days since the applied date (YYYY-MM-DD) until today — shown while waiting for a response. */
function daysSinceApplied(applied: string): number | null {
  if (!applied) return null;
  const then = new Date(applied);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 86_400_000));
}

// Mirrors STALE_APPLICATION_DAYS/WAITING_STATUSES from server/src/modules/analytics/analytics.routes.ts
// (just a color hint in the table — the authoritative source of truth is still "Focus of the week").
const STALE_APPLICATION_DAYS = 14;
const WAITING_STATUSES = ["Applied", "Screening", "Tech interview", "Take-home task", "Final"];
function isStaleApplication(status: string, days: number | null): boolean {
  return days != null && days > STALE_APPLICATION_DAYS && WAITING_STATUSES.includes(status);
}

/* ---------- Vacancies ---------- */
export function Vacancies() {
  const { t } = useTranslation(["vacancies", "common"]);
  const { data: vacancies = [], isLoading } = useVacancies();
  const addVacancyMutation = useAddVacancy();
  const updateVacancyMutation = useUpdateVacancy();
  const deleteVacancyMutation = useDeleteVacancy();
  const importVacanciesMutation = useImportVacancies();
  const importJsonMutation = useImportVacanciesJson();
  const { toast } = useToast();
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const [imp, setImp] = useUi("vacancies.import", "");
  const [view, setView] = useUi<"table" | "board">("vacancies.view", "table");
  const doImport = async () => {
    await importVacanciesMutation.mutateAsync(imp);
    setImp("");
  };
  const onImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const items = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown[] })?.items;
      if (!Array.isArray(items)) throw new Error("Expected an array of vacancies in the file");
      await importJsonMutation.mutateAsync(items);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to read the file", "error");
    }
  };
  const onExportJson = async () => {
    try {
      const items = await api.exportVacancies();
      downloadJson("job-tracker.json", items);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to export vacancies", "error");
    }
  };
  if (isLoading) return <CardsSkeleton count={3} />;
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
              <Btn variant={view === "table" ? "primary" : "subtle"} size="sm" onClick={() => setView("table")}>
                {t("view.table")}
              </Btn>
              <Btn variant={view === "board" ? "primary" : "subtle"} size="sm" onClick={() => setView("board")}>
                {t("view.board")}
              </Btn>
            </div>
            <Btn
              loading={addVacancyMutation.isPending}
              onClick={() => addVacancyMutation.mutate({ company: "New company", position: "Position" })}
            >
              {t("addVacancy")}
            </Btn>
          </div>
        }
      />

      <Card>
        <div className="text-sm font-semibold mb-2 text-ink">{t("import.heading")}</div>
        <textarea
          value={imp}
          onChange={(e) => setImp(e.target.value)}
          aria-label={t("import.ariaLabel")}
          placeholder={t("import.placeholder")}
          className="w-full h-20 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
        />
        <Btn className="mt-2" variant="ghost" onClick={doImport} disabled={!imp} loading={importVacanciesMutation.isPending}>
          {importVacanciesMutation.isPending ? t("import.importing") : t("import.importLinks")}
        </Btn>
      </Card>

      <Card>
        <div className="text-sm font-semibold mb-1 text-ink">{t("jsonImportExport.heading")}</div>
        <p className="text-xs text-ink-dim mb-2">
          {t("jsonImportExport.formatIntro")} <code>job-tracker.json</code> — {t("jsonImportExport.formatSchema")}{" "}
          <code>{"{company, pos, level, fit, status, applied, next, notes, url}"}</code>. {t("jsonImportExport.syncNote")}
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={jsonFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportJsonFile}
            className="hidden"
            aria-label={t("jsonImportExport.fileAriaLabel")}
          />
          <Btn variant="ghost" onClick={() => jsonFileInputRef.current?.click()} loading={importJsonMutation.isPending}>
            {importJsonMutation.isPending ? t("jsonImportExport.importing") : t("jsonImportExport.importFromFile")}
          </Btn>
          <Btn variant="ghost" onClick={onExportJson} disabled={vacancies.length === 0}>
            {t("jsonImportExport.exportToFile")}
          </Btn>
        </div>
      </Card>

      {vacancies.length === 0 ? (
        <Card>
          <EmptyState
            icon="📋"
            title={t("empty.title")}
            hint={t("empty.hint")}
            action={
              <Btn
                loading={addVacancyMutation.isPending}
                onClick={() => addVacancyMutation.mutate({ company: "New company", position: "Position" })}
              >
                {t("addFirst")}
              </Btn>
            }
          />
        </Card>
      ) : view === "board" ? (
        <VacancyBoard />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-dim text-xs text-left bg-surface-2 border-b border-grid">
                  <th className="p-3 w-10 text-right">#</th>
                  <th className="p-3">{t("table.companyPosition")}</th>
                  <th className="p-3">{t("table.stack")}</th>
                  <th className="p-3">{t("table.fit")}</th>
                  <th className="p-3">{t("table.status")}</th>
                  <th className="p-3">{t("table.applied")}</th>
                  <th className="p-3">{t("table.nextStep")}</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map((row, i) => {
                  // updateVacancyMutation is one hook for the whole table, so scope "saving" to
                  // exactly the row whose id matches the last call's variables (React Query holds
                  // variables while isPending) — otherwise the spinner would flash on every row at once.
                  const isSavingRow = updateVacancyMutation.isPending && updateVacancyMutation.variables?.id === row.id;
                  const isDeletingRow = deleteVacancyMutation.isPending && deleteVacancyMutation.variables === row.id;
                  return (
                    <tr key={row.id} className="border-t border-surface-2 align-top hover:bg-surface-2/60">
                      <td className="p-3 text-right text-ink-dim text-xs tabular-nums">{i + 1}</td>
                      <td className="p-3">
                        <input
                          defaultValue={row.company}
                          onBlur={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { company: e.target.value } })}
                          className="bg-transparent font-semibold w-full outline-none focus:bg-surface focus:ring-1 focus:ring-signal/40 rounded px-1"
                        />
                        <input
                          defaultValue={row.position}
                          onBlur={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { position: e.target.value } })}
                          className="bg-transparent text-ink-dim text-xs w-full outline-none focus:bg-surface focus:ring-1 focus:ring-signal/40 rounded px-1"
                        />
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="url"
                            defaultValue={row.url}
                            onBlur={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { url: e.target.value } })}
                            placeholder={t("table.vacancyLinkPlaceholder")}
                            aria-label={t("table.vacancyLinkAriaLabel", { company: row.company })}
                            className="bg-transparent text-signal text-[11px] flex-1 min-w-0 outline-none focus:bg-surface focus:ring-1 focus:ring-signal/40 rounded px-1"
                          />
                          {row.url && (
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                              title={t("table.openVacancy")}
                              className="text-signal text-xs shrink-0"
                            >
                              ↗
                            </a>
                          )}
                          <SimilarVacanciesButton vacancyId={row.id} />
                        </div>
                        {isSavingRow && (
                          <div className="flex items-center gap-1 text-[11px] text-signal mt-0.5">
                            <Spinner className="h-3 w-3" /> {t("common:state.saving")}
                          </div>
                        )}
                      </td>
                      <td className="p-3 max-w-[220px]">
                        <div className="flex flex-wrap gap-1">
                          {row.stack.length === 0 ? (
                            <span className="text-xs text-ink-dim">—</span>
                          ) : (
                            row.stack.map((s) => (
                              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-dim border border-grid">
                                {s}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <select
                          defaultValue={row.fit}
                          onChange={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { fit: e.target.value as Fit } })}
                          className={`bg-surface-2 border border-grid rounded px-1.5 py-1 text-xs font-medium ${fitText[row.fit]}`}
                        >
                          <option value="high">{fitLabel("high")}</option>
                          <option value="med">{fitLabel("med")}</option>
                          <option value="low">{fitLabel("low")}</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          defaultValue={row.status}
                          onChange={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { status: e.target.value } })}
                          className={`border rounded px-1.5 py-1 text-xs font-medium ${
                            STATUS_SELECT_CLASS[row.status as VacancyStatus] ?? DEFAULT_STATUS_SELECT_CLASS
                          }`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <DateInput
                          value={row.applied}
                          onChange={(iso) => updateVacancyMutation.mutate({ id: row.id, patch: { applied: iso } })}
                          aria-label={t("table.appliedDateAriaLabel", { company: row.company })}
                          className="bg-transparent w-32 outline-none focus:bg-surface focus:ring-1 focus:ring-signal/40 rounded px-1 text-xs"
                        />
                        {daysSinceApplied(row.applied) != null && (
                          <div
                            className={`text-[11px] mt-0.5 ${
                              isStaleApplication(row.status, daysSinceApplied(row.applied)) ? "text-rose-600 font-medium" : "text-ink-dim"
                            }`}
                            title={
                              isStaleApplication(row.status, daysSinceApplied(row.applied))
                                ? t("table.staleTooltip", { days: STALE_APPLICATION_DAYS })
                                : undefined
                            }
                          >
                            {t("table.daysWaiting", { count: daysSinceApplied(row.applied)! })}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <DateInput
                          value={row.next}
                          onChange={(iso) => updateVacancyMutation.mutate({ id: row.id, patch: { next: iso } })}
                          aria-label={t("table.nextStepDateAriaLabel", { company: row.company })}
                          className="bg-transparent w-32 outline-none focus:bg-surface focus:ring-1 focus:ring-signal/40 rounded px-1 text-xs"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => deleteVacancyMutation.mutate(row.id)}
                          disabled={isDeletingRow}
                          className="text-ink-dim hover:text-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t("common:actions.delete")}
                        >
                          {isDeletingRow ? <Spinner className="h-3.5 w-3.5" /> : "✕"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
