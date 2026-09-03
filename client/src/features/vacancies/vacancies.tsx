import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUi } from "../../shared/ui-state";
import {
  useContacts,
  useDeleteVacancy,
  useImportVacancies,
  useImportVacanciesJson,
  useUpdateVacancy,
  useVacancies,
} from "../../shared/queries";
import { api } from "../../shared/api";
import { useToast } from "../../shared/use-toast";
import { useConfirm } from "../../shared/use-confirm";
import { Btn, Card, CardsSkeleton, Dropdown, EmptyState, PageHeader, Segmented, Spinner } from "../../shared/ui";
import { DateInput } from "../../shared/date-input";
import { StarIcon } from "../../shared/icons";
import { STATUSES, type Fit, type VacancyStatus } from "../../shared/types";
import { fitText, fitLabel } from "../../shared/fit-tone";
import { statusLabel } from "../../shared/status-labels";
import { STATUS_SELECT_CLASS, DEFAULT_STATUS_SELECT_CLASS } from "../../shared/status-tone";
import { VacancyBoard } from "./kanban-board";
import { SimilarVacanciesButton } from "./similar-vacancies-button";
import { VacancyDetailModal } from "./vacancy-detail-modal";
import { VacancyCreateModal } from "./vacancy-create-modal";
import { filterAndSortVacancies, COLUMN_LABEL_KEY, OPTIONAL_COLUMNS, type SortKey, type ColumnKey } from "./vacancies-filter";

// useUi's "vacancies.view" is in-memory only (see ui-state.ts) — it survives switching tabs
// within the SPA but resets to the default on every reload/new session. The table/board choice
// specifically should stick across those too, so it's separately mirrored to localStorage here
// (same pattern as theme.ts), while every other "vacancies.*" useUi key stays session-only.
const VIEW_STORAGE_KEY = "jobtrack.vacancies.view";
// Same breakpoint dashboard.tsx's own mobile check uses (Tailwind's `lg`). Only the FIRST-EVER
// visit on a narrow screen defaults here — once anything is stored, that choice always wins,
// even if the user later opens the app on a different-sized screen. Table's columns (Fit/Salary/
// Status/Applied/Next-step) scroll off-screen on a phone with no visual hint they exist; Kanban
// is already swipeable and puts status/fit right on the card.
const DESKTOP_MIN_WIDTH = 1024;
function readStoredView(): "table" | "board" {
  const stored = localStorage.getItem(VIEW_STORAGE_KEY);
  if (stored === "board" || stored === "table") return stored;
  return typeof window !== "undefined" && window.innerWidth < DESKTOP_MIN_WIDTH ? "board" : "table";
}

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

/** Formats the `created` column (YYYY-MM-DD) for display, locale-aware. Empty/invalid → "—". */
function formatCreated(created: string | undefined, locale: string): string {
  if (!created) return "—";
  const d = new Date(created);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(locale);
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

const STACK_VISIBLE_COUNT = 3;

/** The table view's stack cell used to render every tag uncollapsed — a vacancy with ~20 tags
 * stretched across 8 lines and pushed the rest of the table off-screen. Capped the same way
 * kanban-board.tsx's card already does (a static "+N", not expandable in place) — the full stack
 * is one click away regardless, via the row's own "open details" button opening
 * VacancyDetailModal, which always shows it in full. */
function StackCell({ stack }: { stack: string[] }) {
  if (stack.length === 0) return <span className="text-xs text-ink-dim">—</span>;
  const hiddenCount = stack.length - STACK_VISIBLE_COUNT;
  const shown = hiddenCount > 0 ? stack.slice(0, STACK_VISIBLE_COUNT) : stack;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-dim border border-grid">
          {s}
        </span>
      ))}
      {hiddenCount > 0 && <span className="text-[10px] px-1 text-ink-dim self-center">+{hiddenCount}</span>}
    </div>
  );
}

/* ---------- Vacancies ---------- */
export function Vacancies() {
  const { t, i18n } = useTranslation(["vacancies", "common"]);
  const confirm = useConfirm();
  const { data: vacancies = [], isLoading } = useVacancies();
  const { data: contacts = [] } = useContacts();
  const contactsFor = (vacancyId: number) => contacts.filter((c) => c.vacancyId === vacancyId);
  // The "Jira issue"-style detail popup — cover letter + fit analysis + every editable field,
  // scoped to one vacancy (see vacancy-detail-modal.tsx). Kept as the live object from `vacancies`
  // (re-derived below) rather than just an id, so edits made elsewhere (e.g. the table row itself,
  // if both are visible) are reflected without an extra lookup.
  const [detailVacancyId, setDetailVacancyId] = useState<number | null>(null);
  const detailVacancy = detailVacancyId != null ? vacancies.find((v) => v.id === detailVacancyId) : undefined;
  // The "Add vacancy" flow: a dedicated blank-form modal (vacancy-create-modal.tsx) that only
  // POSTs on an explicit Save, rather than creating a placeholder row immediately and opening the
  // (auto-saving) detail modal on it — see that file's doc comment for why.
  const [createOpen, setCreateOpen] = useState(false);
  const updateVacancyMutation = useUpdateVacancy();
  const deleteVacancyMutation = useDeleteVacancy();
  const importVacanciesMutation = useImportVacancies();
  const importJsonMutation = useImportVacanciesJson();
  const { toast } = useToast();
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const [imp, setImp] = useUi("vacancies.import", "");
  const [view, setViewUi] = useUi<"table" | "board">("vacancies.view", readStoredView());
  const setView = (v: "table" | "board") => {
    setViewUi(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  };
  const [search, setSearch] = useUi("vacancies.search", "");
  const [filterStatus, setFilterStatus] = useUi<string[]>("vacancies.filterStatus", []);
  const [filterFit, setFilterFit] = useUi<string[]>("vacancies.filterFit", []);
  const toggleStatusFilter = (s: string) =>
    setFilterStatus(filterStatus.includes(s) ? filterStatus.filter((x) => x !== s) : [...filterStatus, s]);
  const toggleFitFilter = (f: string) => setFilterFit(filterFit.includes(f) ? filterFit.filter((x) => x !== f) : [...filterFit, f]);
  const [favoritesOnly, setFavoritesOnly] = useUi<boolean>("vacancies.favoritesOnly", false);
  const [sortBy, setSortBy] = useUi<SortKey>("vacancies.sortBy", "default");
  const [sortDir, setSortDir] = useUi<"asc" | "desc">("vacancies.sortDir", "asc");
  // "created" starts hidden — it's the newest column and, added on top of every other one, was
  // enough to push the table past the viewport width and force a horizontal scrollbar that wasn't
  // there before. Still one click away via the Columns menu (or always visible in the detail modal).
  const [hiddenColumns, setHiddenColumns] = useUi<ColumnKey[]>("vacancies.hiddenColumns", ["created"]);
  const isColVisible = (key: ColumnKey) => !hiddenColumns.includes(key);
  const toggleColumn = (key: ColumnKey) =>
    setHiddenColumns(isColVisible(key) ? [...hiddenColumns, key] : hiddenColumns.filter((k) => k !== key));
  const toggleSort = (key: Exclude<SortKey, "default">) => {
    if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };
  const sortArrow = (key: SortKey) => (sortBy === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const hasActiveFilters = filterStatus.length > 0 || filterFit.length > 0 || favoritesOnly || search.trim() !== "";
  const resetFilters = () => {
    setSearch("");
    setFilterStatus([]);
    setFilterFit([]);
    setFavoritesOnly(false);
  };
  const visibleVacancies = filterAndSortVacancies(vacancies, {
    search,
    status: filterStatus,
    fit: filterFit,
    favoritesOnly,
    sortBy,
    sortDir,
  });
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
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2 flex-wrap">
            {/* Shared `Segmented` (shared/ui.tsx) rather than a hand-rolled row of Btns in a
                rounded track — this was one of three places that reimplemented the same control
                slightly differently, so the app showed the user two visually distinct answers to
                "these are mutually exclusive views of one thing". */}
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "table", label: t("view.table") },
                { value: "board", label: t("view.board") },
              ]}
            />
            <Btn onClick={() => setCreateOpen(true)}>{t("addVacancy")}</Btn>
            {/* Collapsed by default — the two import forms used to render as full-width cards
                ABOVE the table/board on every visit, pushing every actual vacancy off-screen on
                first load. Grouped into one Dropdown, same pattern as cv-builder.tsx's own
                "Import ▾" menu; data-keep-open on the interactive bits so typing/clicking inside
                doesn't close the panel out from under the user (see cv-builder.tsx's <select
                data-keep-open> for the precedent). width=360: wider than Dropdown's 220px
                default (a short menu-item list) since this panel holds a textarea + descriptive
                text — Dropdown's positioning math needs the REAL width or the panel overflows
                the viewport and clips its own content on the right (this happened before this
                comment was written: the panel was still positioned as if 220px wide). */}
            <Dropdown label={t("importMenu.label")} align="right" width={360}>
              <div data-keep-open>
                <div className="text-sm font-semibold mb-2 text-ink px-1">{t("import.heading")}</div>
                <textarea
                  value={imp}
                  onChange={(e) => setImp(e.target.value)}
                  aria-label={t("import.ariaLabel")}
                  placeholder={t("import.placeholder")}
                  className="w-full h-20 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
                <Btn className="mt-2 w-full" variant="ghost" onClick={doImport} disabled={!imp} loading={importVacanciesMutation.isPending}>
                  {importVacanciesMutation.isPending ? t("import.importing") : t("import.importLinks")}
                </Btn>
              </div>
              <div className="border-t border-grid my-2" />
              <div data-keep-open>
                <div className="text-sm font-semibold mb-1 text-ink px-1">{t("jsonImportExport.heading")}</div>
                <p className="text-xs text-ink-dim mb-2 px-1">
                  {t("jsonImportExport.formatIntro")} <code>job-tracker.json</code> — {t("jsonImportExport.formatSchema")}{" "}
                  <code>{"{company, pos, level, salary, fit, status, applied, next, notes, url}"}</code>. {t("jsonImportExport.syncNote")}
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    ref={jsonFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={onImportJsonFile}
                    className="hidden"
                    aria-label={t("jsonImportExport.fileAriaLabel")}
                  />
                  <Btn
                    variant="ghost"
                    className="w-full"
                    onClick={() => jsonFileInputRef.current?.click()}
                    loading={importJsonMutation.isPending}
                  >
                    {importJsonMutation.isPending ? t("jsonImportExport.importing") : t("jsonImportExport.importFromFile")}
                  </Btn>
                  <Btn variant="ghost" className="w-full" onClick={onExportJson} disabled={vacancies.length === 0}>
                    {t("jsonImportExport.exportToFile")}
                  </Btn>
                </div>
              </div>
            </Dropdown>
          </div>
        }
      />

      {vacancies.length === 0 ? (
        <Card>
          <EmptyState
            title={t("empty.title")}
            hint={t("empty.hint")}
            action={<Btn onClick={() => setCreateOpen(true)}>{t("addFirst")}</Btn>}
          />
        </Card>
      ) : view === "board" ? (
        <VacancyBoard onOpenDetail={setDetailVacancyId} />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                aria-label={t("filters.searchAriaLabel")}
                className="flex-1 min-w-[180px] bg-surface-2 border border-grid rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
              />
              {/* Multi-select checkbox dropdowns (same pattern as the "Columns" menu below) rather
                  than single-value <select>s — lets you filter by several statuses/fit levels at
                  once (e.g. "Applied" + "Screening" together), OR'd within their own category. */}
              <Dropdown
                label={filterStatus.length === 0 ? t("filters.allStatuses") : t("filters.statusCount", { count: filterStatus.length })}
              >
                {STATUSES.map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-ink rounded-lg hover:bg-surface-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filterStatus.includes(s)}
                      onChange={() => toggleStatusFilter(s)}
                      className="accent-signal"
                    />
                    {statusLabel(s)}
                  </label>
                ))}
              </Dropdown>
              <Dropdown label={filterFit.length === 0 ? t("filters.allFits") : t("filters.fitCount", { count: filterFit.length })}>
                {(["high", "med", "low"] as const).map((f) => (
                  <label
                    key={f}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-ink rounded-lg hover:bg-surface-2 cursor-pointer"
                  >
                    <input type="checkbox" checked={filterFit.includes(f)} onChange={() => toggleFitFilter(f)} className="accent-signal" />
                    {fitLabel(f)}
                  </label>
                ))}
              </Dropdown>
              <button
                type="button"
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                aria-pressed={favoritesOnly}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm border ${
                  favoritesOnly ? "bg-amber-400/10 border-amber-400/40 text-amber-500" : "border-grid text-ink-dim hover:bg-surface-2"
                }`}
              >
                <StarIcon className="h-3.5 w-3.5" fill={favoritesOnly ? "currentColor" : "none"} />
                {t("filters.favoritesOnly")}
              </button>
              <Dropdown label={t("filters.columns")}>
                {OPTIONAL_COLUMNS.map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-ink rounded-lg hover:bg-surface-2 cursor-pointer"
                  >
                    <input type="checkbox" checked={isColVisible(key)} onChange={() => toggleColumn(key)} className="accent-signal" />
                    {t(COLUMN_LABEL_KEY[key])}
                  </label>
                ))}
              </Dropdown>
              {hasActiveFilters && (
                <Btn size="sm" variant="ghost" onClick={resetFilters}>
                  {t("filters.reset")}
                </Btn>
              )}
            </div>
          </Card>

          {visibleVacancies.length === 0 ? (
            <Card>
              <EmptyState
                title={t("filters.noMatches.title")}
                hint={t("filters.noMatches.hint")}
                action={
                  <Btn size="sm" variant="ghost" onClick={resetFilters}>
                    {t("filters.reset")}
                  </Btn>
                }
              />
            </Card>
          ) : (
            <Card className="!p-0 overflow-hidden">
              {/* `overflow-auto` (not `-x-auto`) + a capped height makes THIS div — not the page —
                  the scrolling ancestor, which is what lets the `sticky` thead below actually stick:
                  sticky resolves against the nearest ancestor with non-`visible` overflow, and an
                  ancestor that never itself scrolls (e.g. this Card's own `overflow-hidden`, which
                  only exists to clip the table to its rounded corners) makes sticky silently no-op. */}
              <div className="overflow-auto max-h-[65vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-ink-dim text-xs text-left bg-surface-2 border-b border-grid">
                      <th className="p-3 w-10 text-right">#</th>
                      <th className="p-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("company")}>
                        {t("table.companyPosition")}
                        {sortArrow("company")}
                      </th>
                      {isColVisible("stack") && <th className="p-3">{t("table.stack")}</th>}
                      {isColVisible("fit") && (
                        <th className="p-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("fit")}>
                          {t("table.fit")}
                          {sortArrow("fit")}
                        </th>
                      )}
                      {isColVisible("salary") && <th className="p-3">{t("table.salary")}</th>}
                      {isColVisible("contacts") && <th className="p-3">{t("table.contacts")}</th>}
                      <th className="p-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("status")}>
                        {t("table.status")}
                        {sortArrow("status")}
                      </th>
                      {isColVisible("applied") && (
                        <th className="p-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("applied")}>
                          {t("table.applied")}
                          {sortArrow("applied")}
                        </th>
                      )}
                      {isColVisible("next") && (
                        <th className="p-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("next")}>
                          {t("table.nextStep")}
                          {sortArrow("next")}
                        </th>
                      )}
                      {isColVisible("created") && (
                        <th className="p-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("created")}>
                          {t("table.created")}
                          {sortArrow("created")}
                        </th>
                      )}
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleVacancies.map((row, i) => {
                      // updateVacancyMutation is one hook for the whole table, so scope "saving" to
                      // exactly the row whose id matches the last call's variables (React Query holds
                      // variables while isPending) — otherwise the spinner would flash on every row at once.
                      const isSavingRow = updateVacancyMutation.isPending && updateVacancyMutation.variables?.id === row.id;
                      const isDeletingRow = deleteVacancyMutation.isPending && deleteVacancyMutation.variables === row.id;
                      return (
                        <tr
                          key={row.id}
                          title={t("detail.openTitle")}
                          // Clicking anywhere on the row opens the detail popup — EXCEPT an
                          // actual control (the inline company/position/url inputs, status/fit
                          // selects, date pickers, Similar-vacancies button, delete button):
                          // those need the click for themselves. Same pattern as the Kanban
                          // card's onClick (kanban-board.tsx). A small "open" button in just one
                          // cell (the original approach here) was too easy to miss — this is the
                          // discoverable, "click the row like a Jira issue" version.
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("input, select, textarea, button, a")) return;
                            setDetailVacancyId(row.id);
                          }}
                          className="border-t border-surface-2 align-top hover:bg-surface-2/60 cursor-pointer"
                        >
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => updateVacancyMutation.mutate({ id: row.id, patch: { favorite: !row.favorite } })}
                                title={row.favorite ? t("favorite.removeTitle") : t("favorite.addTitle")}
                                aria-label={t(row.favorite ? "favorite.removeAriaLabel" : "favorite.addAriaLabel", {
                                  company: row.company,
                                })}
                                aria-pressed={row.favorite}
                                className={`rounded p-0.5 -m-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 ${
                                  row.favorite ? "text-amber-400 hover:text-amber-500" : "text-ink-dim hover:text-amber-400"
                                }`}
                              >
                                <StarIcon className="h-3.5 w-3.5" fill={row.favorite ? "currentColor" : "none"} />
                              </button>
                              {/* A plain onClick on <tr> isn't reachable by keyboard/screen readers
                                  — this button is the accessible entry point to the same action for
                                  anyone not using a mouse; the row-wide click above is the
                                  discoverable convenience on top of it, not a replacement for it. */}
                              <button
                                type="button"
                                onClick={() => setDetailVacancyId(row.id)}
                                title={t("detail.openTitle")}
                                aria-label={t("detail.openAriaLabel", { company: row.company, position: row.position })}
                                className="text-ink-dim text-xs tabular-nums hover:text-signal hover:underline rounded px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
                              >
                                {/* Counted UP from the bottom, so the default (newest-first) order
                                    puts the total on the newest row and 1 on the very first
                                    vacancy ever added — "this is my 43rd application", which is
                                    the number worth seeing. Numbering downward from the top made
                                    the newest row a permanent "1" and quietly renumbered every
                                    row below it on each save. It stays positional either way, so
                                    a filter or a column sort narrows/reorders it. */}
                                {visibleVacancies.length - i}
                              </button>
                            </div>
                          </td>
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
                                className="bg-transparent text-signal text-[11px] flex-1 min-w-0 outline-none focus:bg-surface focus:ring-1 focus:ring-signal/40 rounded px-1 text-ellipsis overflow-hidden"
                              />
                              {row.url && (
                                <a
                                  href={row.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={t("table.openVacancy")}
                                  aria-label={t("table.openVacancy")}
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
                          {isColVisible("stack") && (
                            <td className="p-3 max-w-[220px]">
                              <StackCell stack={row.stack} />
                            </td>
                          )}
                          {isColVisible("fit") && (
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
                          )}
                          {isColVisible("salary") && (
                            <td className="p-3">
                              <input
                                defaultValue={row.salary}
                                onBlur={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { salary: e.target.value } })}
                                placeholder={t("table.salaryPlaceholder")}
                                aria-label={t("table.salaryAriaLabel", { company: row.company })}
                                className="bg-transparent w-24 outline-none focus:bg-surface focus:ring-1 focus:ring-signal/40 rounded px-1 text-xs"
                              />
                            </td>
                          )}
                          {isColVisible("contacts") && (
                            <td className="p-3 max-w-[180px]">
                              {contactsFor(row.id).length === 0 ? (
                                <span className="text-xs text-ink-dim">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {contactsFor(row.id).map((c) => (
                                    <span
                                      key={c.id}
                                      title={c.role || undefined}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-dim border border-grid"
                                    >
                                      {c.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          )}
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
                          {isColVisible("applied") && (
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
                                    isStaleApplication(row.status, daysSinceApplied(row.applied))
                                      ? "text-rose-600 font-medium"
                                      : "text-ink-dim"
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
                          )}
                          {isColVisible("next") && (
                            <td className="p-3">
                              <DateInput
                                value={row.next}
                                onChange={(iso) => updateVacancyMutation.mutate({ id: row.id, patch: { next: iso } })}
                                aria-label={t("table.nextStepDateAriaLabel", { company: row.company })}
                                className="bg-transparent w-32 outline-none focus:bg-surface focus:ring-1 focus:ring-signal/40 rounded px-1 text-xs"
                              />
                            </td>
                          )}
                          {isColVisible("created") && (
                            <td className="p-3 text-xs text-ink-dim whitespace-nowrap">{formatCreated(row.created, i18n.language)}</td>
                          )}
                          <td className="p-3 text-right">
                            <button
                              onClick={async () => {
                                if (
                                  await confirm({
                                    title: t("table.deleteConfirmTitle", { company: row.company, position: row.position }),
                                    message: t("table.deleteConfirmMessage"),
                                  })
                                )
                                  deleteVacancyMutation.mutate(row.id);
                              }}
                              disabled={isDeletingRow}
                              className="text-ink-dim hover:text-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={t("common:actions.delete")}
                              aria-label={t("common:actions.delete")}
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
        </>
      )}
      {detailVacancy && <VacancyDetailModal vacancy={detailVacancy} onClose={() => setDetailVacancyId(null)} />}
      {createOpen && (
        <VacancyCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={(row) => {
            setCreateOpen(false);
            setDetailVacancyId(row.id);
          }}
        />
      )}
    </div>
  );
}
