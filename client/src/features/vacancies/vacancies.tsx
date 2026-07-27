import { useState } from "react";
import { useUi } from "../../shared/ui-state";
import { useAddVacancy, useDeleteVacancy, useImportVacancies, useUpdateVacancy, useVacancies } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, Chip, EmptyState, PageHeader } from "../../shared/ui";
import { STATUSES, type Fit } from "../../shared/types";
import { fitTone, fitText } from "../../shared/view-kit";

/* ---------- Vacancies board (drag-and-drop) ---------- */
function VacancyBoard() {
  const { data: vacancies = [] } = useVacancies();
  const updateVacancyMutation = useUpdateVacancy();
  const [over, setOver] = useState<string | null>(null);
  const onDrop = (status: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const v = vacancies.find((x) => x.id === id);
    if (v && v.status !== status) updateVacancyMutation.mutate({ id, patch: { status } });
  };
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      {STATUSES.map((status) => {
        const items = vacancies.filter((v) => v.status === status);
        return (
          <div
            key={status}
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
              {items.map((v) => (
                <div
                  key={v.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(v.id))}
                  className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-card"
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
              ))}
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
  const [imp, setImp] = useUi("vacancies.import", "");
  const [view, setView] = useUi<"table" | "board">("vacancies.view", "table");
  const doImport = async () => {
    await importVacanciesMutation.mutateAsync(imp);
    setImp("");
  };
  if (isLoading) return <CardsSkeleton count={3} />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Вакансії"
        subtitle="Веди всі вакансії в одному місці. У режимі «Канбан» перетягуй картки між статусами."
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
          placeholder="Встав HTML або текст зі збереженої таблиці вакансій DOU — витягнемо всі посилання…"
          className="w-full h-20 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <Btn className="mt-2" variant="ghost" onClick={doImport} disabled={!imp}>
          Імпортувати посилання
        </Btn>
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
                      {row.url && (
                        <a href={row.url} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs">
                          ↗ вакансія
                        </a>
                      )}
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
                        defaultValue={row.next}
                        onBlur={(e) => updateVacancyMutation.mutate({ id: row.id, patch: { next: e.target.value } })}
                        placeholder="—"
                        className="bg-transparent w-28 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1"
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
