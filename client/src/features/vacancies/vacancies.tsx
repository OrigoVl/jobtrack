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
import { Btn, Card, CardsSkeleton, Chip, EmptyState, PageHeader } from "../../shared/ui";
import { STATUSES, type Fit, type Vacancy } from "../../shared/types";
import { fitTone, fitText } from "../../shared/fit-tone";

/** Ініціює завантаження браузером JSON-файлу з переданими даними (для експорту вакансій). */
function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Днів від дати подачі (YYYY-MM-DD) до сьогодні — показуємо, доки чекаємо відповіді. */
function daysSinceApplied(applied: string): number | null {
  if (!applied) return null;
  const then = new Date(applied);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 86_400_000));
}

// Дзеркалить STALE_APPLICATION_DAYS/WAITING_STATUSES із server/src/modules/analytics/analytics.routes.ts
// (лише для кольорового натяку в таблиці — авторитетне джерело правди все одно "Фокус тижня").
const STALE_APPLICATION_DAYS = 14;
const WAITING_STATUSES = ["Відправив CV", "Скринінг", "Тех.співбесіда", "Тестове завдання", "Фінал"];
function isStaleApplication(status: string, days: number | null): boolean {
  return days != null && days > STALE_APPLICATION_DAYS && WAITING_STATUSES.includes(status);
}

/* ---------- Vacancies board (drag-and-drop + клавіатура) ---------- */
function VacancyBoard() {
  const { data: vacancies = [] } = useVacancies();
  const updateVacancyMutation = useUpdateVacancy();
  const [over, setOver] = useState<string | null>(null);
  // Рефи карток для DnD-незалежного (keyboard-only) переміщення: після зміни статусу
  // React перемонтовує картку в іншу колонку — без цього фокус загубився б.
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const onDrop = (status: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const v = vacancies.find((x) => x.id === id);
    if (v && v.status !== status) updateVacancyMutation.mutate({ id, patch: { status } });
  };
  // Клавіатурна альтернатива drag-and-drop: ←/→ на фокусованій картці перемикають
  // її на сусідній статус (порядок — як у STATUSES), фокус лишається на тій самій картці.
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
            aria-label={`Колонка «${status}», ${items.length} вакансій`}
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
              <span className="text-xs font-bold text-slate-600">{status}</span>
              <span className="text-[11px] text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2 min-h-[40px]">
              {items.map((v) => {
                const idx = STATUSES.indexOf(status);
                return (
                  <div
                    key={v.id}
                    ref={(el) => {
                      cardRefs.current[v.id] = el;
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${v.company}, ${v.position}. Статус: ${status}.${idx > 0 ? ` Стрілка вліво — «${STATUSES[idx - 1]}».` : ""}${
                      idx < STATUSES.length - 1 ? ` Стрілка вправо — «${STATUSES[idx + 1]}».` : ""
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
                    className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-card focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
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
    e.target.value = ""; // дозволити повторний вибір того самого файлу
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const items = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown[] })?.items;
      if (!Array.isArray(items)) throw new Error("Очікується масив вакансій у файлі");
      await importJsonMutation.mutateAsync(items);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не вдалося прочитати файл", "error");
    }
  };
  const onExportJson = async () => {
    try {
      const items = await api.exportVacancies();
      downloadJson("job-tracker.json", items);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не вдалося експортувати вакансії", "error");
    }
  };
  if (isLoading) return <CardsSkeleton count={3} />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Вакансії"
        subtitle="Веди всі вакансії в одному місці. Встав посилання на вакансію (jobs.dou.ua) — стек підтягнеться сам. У режимі «Канбан» перетягуй картки між статусами (або обери картку й тисни ←/→ — без миші)."
        actions={
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              <Btn variant={view === "table" ? "primary" : "subtle"} size="sm" onClick={() => setView("table")}>
                ☰ Таблиця
              </Btn>
              <Btn variant={view === "board" ? "primary" : "subtle"} size="sm" onClick={() => setView("board")}>
                🗂 Канбан
              </Btn>
            </div>
            <Btn onClick={() => addVacancyMutation.mutate({ company: "Нова компанія", position: "Позиція" })}>+ Додати вакансію</Btn>
          </div>
        }
      />

      <Card>
        <div className="text-sm font-semibold mb-2 text-slate-700">📥 Імпорт з DOU-експорту</div>
        <textarea
          value={imp}
          onChange={(e) => setImp(e.target.value)}
          aria-label="HTML або текст для імпорту з DOU"
          placeholder="Встав HTML або текст зі збереженої таблиці вакансій DOU — витягнемо всі посилання…"
          className="w-full h-20 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <Btn className="mt-2" variant="ghost" onClick={doImport} disabled={!imp}>
          Імпортувати посилання
        </Btn>
      </Card>

      <Card>
        <div className="text-sm font-semibold mb-1 text-slate-700">🔄 Імпорт / експорт JSON</div>
        <p className="text-xs text-slate-500 mb-2">
          Формат <code>job-tracker.json</code> — масив <code>{"{company, pos, level, fit, status, applied, next, notes, url}"}</code>.
          Вакансії з тим самим посиланням (або компанією+позицією) оновляться, решта додасться — можна вести файл окремо (напр. в іншому
          чаті) і просто скидати його сюди для синхронізації.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={jsonFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportJsonFile}
            className="hidden"
            aria-label="Файл job-tracker.json для імпорту"
          />
          <Btn variant="ghost" onClick={() => jsonFileInputRef.current?.click()} disabled={importJsonMutation.isPending}>
            {importJsonMutation.isPending ? "Імпортую…" : "⬆ Імпортувати з файлу"}
          </Btn>
          <Btn variant="ghost" onClick={onExportJson} disabled={vacancies.length === 0}>
            ⬇ Експортувати в job-tracker.json
          </Btn>
        </div>
      </Card>

      {vacancies.length === 0 ? (
        <Card>
          <EmptyState
            icon="📋"
            title="Ще немає вакансій"
            hint="Додай першу вакансію вручну або імпортуй список із DOU — далі застосунок сам збудує аналітику й роудмапу."
            action={<Btn onClick={() => addVacancyMutation.mutate({ company: "Нова компанія", position: "Позиція" })}>+ Додати першу</Btn>}
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
                  <th className="p-3">Компанія / Позиція</th>
                  <th className="p-3">Стек</th>
                  <th className="p-3">Fit</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">Подано</th>
                  <th className="p-3">Наступний крок</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
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
                          placeholder="Посилання (jobs.dou.ua → стек підтягнеться сам)…"
                          aria-label={`Посилання на вакансію — ${row.company}`}
                          className="bg-transparent text-indigo-600 text-[11px] flex-1 min-w-0 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1"
                        />
                        {row.url && (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            title="Відкрити вакансію"
                            className="text-indigo-600 text-xs shrink-0"
                          >
                            ↗
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-3 max-w-[220px]">
                      <div className="flex flex-wrap gap-1">
                        {row.stack.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          row.stack.map((s) => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
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
                        className="bg-slate-100 border border-slate-200 rounded px-1.5 py-1 text-xs"
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
                        aria-label={`Дата подачі заявки — ${row.company}`}
                        className="bg-transparent w-32 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1 text-xs"
                      />
                      {daysSinceApplied(row.applied) != null && (
                        <div
                          className={`text-[11px] mt-0.5 ${
                            isStaleApplication(row.status, daysSinceApplied(row.applied)) ? "text-rose-600 font-medium" : "text-slate-400"
                          }`}
                          title={
                            isStaleApplication(row.status, daysSinceApplied(row.applied))
                              ? `Понад ${STALE_APPLICATION_DAYS} днів без відповіді — варто поштовхнути рекрутера`
                              : undefined
                          }
                        >
                          {daysSinceApplied(row.applied)} дн. очікування
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <input
                        type="date"
                        defaultValue={row.next}
                        onChange={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { next: e.target.value } })}
                        aria-label={`Дата наступного кроку — ${row.company}`}
                        className="bg-transparent w-32 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1 text-xs"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => deleteVacancyMutation.mutate(row.id)}
                        className="text-slate-400 hover:text-rose-500"
                        title="Видалити"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
