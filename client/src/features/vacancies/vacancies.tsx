import { useRef, useState } from "react";
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
import { Btn, Card, CardsSkeleton, Chip, EmptyState, PageHeader, Spinner } from "../../shared/ui";
import { STATUSES, type Fit, type Vacancy, type VacancyStatus } from "../../shared/types";
import { fitTone, fitText } from "../../shared/fit-tone";
import {
  STATUS_SELECT_CLASS,
  STATUS_DOT_CLASS,
  STATUS_BORDER_L_CLASS,
  DEFAULT_STATUS_SELECT_CLASS,
  DEFAULT_STATUS_DOT_CLASS,
  DEFAULT_STATUS_BORDER_L_CLASS,
} from "../../shared/status-tone";

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

/* ---------- Vacancies board (drag-and-drop + keyboard) ---------- */
function VacancyBoard() {
  const { data: vacancies = [] } = useVacancies();
  const updateVacancyMutation = useUpdateVacancy();
  const [over, setOver] = useState<string | null>(null);
  // Card refs for DnD-independent (keyboard-only) moves: after a status change React
  // remounts the card into a different column — without this the focus would be lost.
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const onDrop = (status: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const v = vacancies.find((x) => x.id === id);
    if (v && v.status !== status) updateVacancyMutation.mutate({ id, patch: { status } });
  };
  // Keyboard alternative to drag-and-drop: ←/→ on a focused card switches it to the
  // adjacent status (order — as in STATUSES), focus stays on the same card.
  const moveByKeyboard = (v: Vacancy, direction: -1 | 1) => {
    const idx = STATUSES.indexOf(v.status as (typeof STATUSES)[number]);
    const nextStatus = STATUSES[idx + direction];
    if (idx === -1 || !nextStatus) return;
    updateVacancyMutation.mutate(
      { id: v.id, patch: { status: nextStatus } },
      { onSuccess: () => requestAnimationFrame(() => cardRefs.current[v.id]?.focus()) },
    );
  };
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      {STATUSES.map((status) => {
        const items = vacancies.filter((v) => v.status === status);
        return (
          <div
            key={status}
            role="list"
            aria-label={`Column "${status}", ${items.length} vacancies`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((cur) => (cur === status ? null : cur))}
            onDrop={onDrop(status)}
            className={`shrink-0 w-64 rounded-xl border p-2 transition-colors ${
              over === status ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between px-1.5 py-1 mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT_CLASS[status] ?? DEFAULT_STATUS_DOT_CLASS}`} />
                {status}
              </span>
              <span className="text-[11px] text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2 min-h-[40px]">
              {items.map((v) => {
                const idx = STATUSES.indexOf(status);
                // Mark exactly the card whose status is currently being saved (drag-and-drop or
                // keyboard move) — updateVacancyMutation is one hook for the whole board, so
                // scope by variables.id so the spinner doesn't flash on every card at once.
                const isSaving = updateVacancyMutation.isPending && updateVacancyMutation.variables?.id === v.id;
                return (
                  <div
                    key={v.id}
                    ref={(el) => {
                      cardRefs.current[v.id] = el;
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${v.company}, ${v.position}. Status: ${status}.${idx > 0 ? ` Left arrow — "${STATUSES[idx - 1]}".` : ""}${
                      idx < STATUSES.length - 1 ? ` Right arrow — "${STATUSES[idx + 1]}".` : ""
                    }`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(v.id))}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        moveByKeyboard(v, 1);
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        moveByKeyboard(v, -1);
                      }
                    }}
                    className={`relative bg-white border border-slate-200 border-l-4 ${STATUS_BORDER_L_CLASS[status] ?? DEFAULT_STATUS_BORDER_L_CLASS} rounded-lg p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-card focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-opacity ${isSaving ? "opacity-60" : ""}`}
                  >
                    {isSaving && (
                      <span className="absolute top-1.5 right-1.5 text-indigo-500" aria-label="Saving…">
                        <Spinner className="h-3 w-3" />
                      </span>
                    )}
                    <div className="font-semibold text-sm text-slate-800 truncate">{v.company}</div>
                    <div className="text-xs text-slate-500 truncate">{v.position}</div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Chip tone={fitTone[v.fit]}>{v.fit}</Chip>
                      {v.stack.slice(0, 2).map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {s}
                        </span>
                      ))}
                      {v.stack.length > 2 && <span className="text-[10px] text-slate-400">+{v.stack.length - 2}</span>}
                    </div>
                    {v.next && <div className="text-[11px] text-amber-600 mt-1">⏭ {v.next}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Vacancies ---------- */
export function Vacancies() {
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
        title="Vacancies"
        subtitle="Track all your vacancies in one place. Paste a vacancy link (from any site — LinkedIn, Djinni, robota.ua, dou.ua, etc.) and the stack fills in itself. In Kanban view, drag cards between statuses (or select a card and press ←/→ — no mouse needed)."
        actions={
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              <Btn variant={view === "table" ? "primary" : "subtle"} size="sm" onClick={() => setView("table")}>
                ☰ Table
              </Btn>
              <Btn variant={view === "board" ? "primary" : "subtle"} size="sm" onClick={() => setView("board")}>
                🗂 Kanban
              </Btn>
            </div>
            <Btn
              loading={addVacancyMutation.isPending}
              onClick={() => addVacancyMutation.mutate({ company: "New company", position: "Position" })}
            >
              + Add vacancy
            </Btn>
          </div>
        }
      />

      <Card>
        <div className="text-sm font-semibold mb-2 text-slate-700">📥 Import from a DOU export</div>
        <textarea
          value={imp}
          onChange={(e) => setImp(e.target.value)}
          aria-label="HTML or text to import from DOU"
          placeholder="Paste the HTML or text of a saved DOU vacancies table — we'll extract every link…"
          className="w-full h-20 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <Btn className="mt-2" variant="ghost" onClick={doImport} disabled={!imp} loading={importVacanciesMutation.isPending}>
          {importVacanciesMutation.isPending ? "Importing and analyzing…" : "Import links"}
        </Btn>
      </Card>

      <Card>
        <div className="text-sm font-semibold mb-1 text-slate-700">🔄 Import / export JSON</div>
        <p className="text-xs text-slate-500 mb-2">
          Format <code>job-tracker.json</code> — an array of <code>{"{company, pos, level, fit, status, applied, next, notes, url}"}</code>.
          Vacancies with the same link (or company+position) get updated, the rest get added — you can keep the file elsewhere (e.g. in
          another chat) and just drop it here to sync.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={jsonFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportJsonFile}
            className="hidden"
            aria-label="job-tracker.json file to import"
          />
          <Btn variant="ghost" onClick={() => jsonFileInputRef.current?.click()} loading={importJsonMutation.isPending}>
            {importJsonMutation.isPending ? "Importing…" : "⬆ Import from file"}
          </Btn>
          <Btn variant="ghost" onClick={onExportJson} disabled={vacancies.length === 0}>
            ⬇ Export to job-tracker.json
          </Btn>
        </div>
      </Card>

      {vacancies.length === 0 ? (
        <Card>
          <EmptyState
            icon="📋"
            title="No vacancies yet"
            hint="Add your first vacancy by hand or import a list from DOU — the app will build the analytics and roadmap from there."
            action={
              <Btn
                loading={addVacancyMutation.isPending}
                onClick={() => addVacancyMutation.mutate({ company: "New company", position: "Position" })}
              >
                + Add the first one
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
                <tr className="text-slate-500 text-xs text-left bg-slate-50 border-b border-slate-200">
                  <th className="p-3 w-10 text-right">#</th>
                  <th className="p-3">Company / Position</th>
                  <th className="p-3">Stack</th>
                  <th className="p-3">Fit</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Applied</th>
                  <th className="p-3">Next step</th>
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
                    <tr key={row.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                      <td className="p-3 text-right text-slate-400 text-xs tabular-nums">{i + 1}</td>
                      <td className="p-3">
                        <input
                          defaultValue={row.company}
                          onBlur={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { company: e.target.value } })}
                          className="bg-transparent font-semibold w-full outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1"
                        />
                        <input
                          defaultValue={row.position}
                          onBlur={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { position: e.target.value } })}
                          className="bg-transparent text-slate-500 text-xs w-full outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1"
                        />
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="url"
                            defaultValue={row.url}
                            onBlur={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { url: e.target.value } })}
                            placeholder="Vacancy link (from any site) → the stack fills in itself…"
                            aria-label={`Vacancy link — ${row.company}`}
                            className="bg-transparent text-indigo-600 text-[11px] flex-1 min-w-0 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1"
                          />
                          {row.url && (
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                              title="Open the vacancy"
                              className="text-indigo-600 text-xs shrink-0"
                            >
                              ↗
                            </a>
                          )}
                        </div>
                        {isSavingRow && (
                          <div className="flex items-center gap-1 text-[11px] text-indigo-500 mt-0.5">
                            <Spinner className="h-3 w-3" /> Saving…
                          </div>
                        )}
                      </td>
                      <td className="p-3 max-w-[220px]">
                        <div className="flex flex-wrap gap-1">
                          {row.stack.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            row.stack.map((s) => (
                              <span
                                key={s}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                              >
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
                          className={`bg-slate-100 border border-slate-200 rounded px-1.5 py-1 text-xs font-medium ${fitText[row.fit]}`}
                        >
                          <option value="high">High</option>
                          <option value="med">Med</option>
                          <option value="low">Low</option>
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
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="date"
                          defaultValue={row.applied}
                          onChange={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { applied: e.target.value } })}
                          aria-label={`Applied date — ${row.company}`}
                          className="bg-transparent w-32 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1 text-xs"
                        />
                        {daysSinceApplied(row.applied) != null && (
                          <div
                            className={`text-[11px] mt-0.5 ${
                              isStaleApplication(row.status, daysSinceApplied(row.applied)) ? "text-rose-600 font-medium" : "text-slate-400"
                            }`}
                            title={
                              isStaleApplication(row.status, daysSinceApplied(row.applied))
                                ? `More than ${STALE_APPLICATION_DAYS} days without a response — worth nudging the recruiter`
                                : undefined
                            }
                          >
                            {daysSinceApplied(row.applied)}d waiting
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <input
                          type="date"
                          defaultValue={row.next}
                          onChange={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { next: e.target.value } })}
                          aria-label={`Next step date — ${row.company}`}
                          className="bg-transparent w-32 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1 text-xs"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => deleteVacancyMutation.mutate(row.id)}
                          disabled={isDeletingRow}
                          className="text-slate-400 hover:text-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete"
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
