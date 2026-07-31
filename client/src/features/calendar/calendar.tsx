import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCombinedCalendar,
  useAddCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  useVacancies,
} from "../../shared/queries";
import { Btn, Card, CardsSkeleton, Chip, EmptyState, PageHeader, Spinner } from "../../shared/ui";
import { DateTimeInput } from "../../shared/date-input";
import {
  CALENDAR_EVENT_TYPES,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarEventInput,
  type CalendarVacancyStep,
} from "../../shared/types";
import { buildMonthCells, fromLocalInput, toLocalInput, ymd } from "./calendar-date-utils";

const TYPE_DOT: Record<CalendarEventType, string> = {
  interview: "bg-signal",
  call: "bg-sky-500",
  deadline: "bg-rose-500",
  reminder: "bg-alert",
  other: "bg-ink-dim",
};
const TYPE_CHIP: Record<CalendarEventType, string> = {
  interview: "bg-signal/10 text-signal border-signal/30",
  call: "bg-sky-50 text-sky-700 border-sky-200",
  deadline: "bg-rose-50 text-rose-700 border-rose-200",
  reminder: "bg-alert/10 text-alert border-alert/30",
  other: "bg-surface-2 text-ink-dim border-grid",
};
const TYPE_LABEL: Record<CalendarEventType, string> = {
  interview: "Interview",
  call: "Call",
  deadline: "Deadline",
  reminder: "Reminder",
  other: "Other",
};
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const TIME_LABEL = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

const EMPTY_DRAFT: CalendarEventInput = { title: "", notes: "", startAt: "", endAt: null, type: "other", vacancyId: null };

function EventModal({
  draft,
  editingId,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  draft: CalendarEventInput;
  editingId: number | null;
  onClose: () => void;
  onSave: (draft: CalendarEventInput) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const [form, setForm] = useState(draft);
  const { data: vacancies = [] } = useVacancies();
  const set = <K extends keyof CalendarEventInput>(k: K, v: CalendarEventInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.title.trim().length > 0 && form.startAt.length > 0;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 bg-ink/50 cursor-default" />
      <Card className="relative w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="font-display font-semibold text-ink">{editingId ? "Edit event" : "New event"}</div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">Title</span>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. On-site interview at Acme"
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">Starts</span>
            <DateTimeInput
              value={toLocalInput(form.startAt)}
              onChange={(local) => set("startAt", fromLocalInput(local) ?? "")}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">Ends (optional)</span>
            <DateTimeInput
              value={toLocalInput(form.endAt)}
              onChange={(local) => set("endAt", fromLocalInput(local))}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">Type</span>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value as CalendarEventType)}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          >
            {CALENDAR_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">Linked vacancy (optional)</span>
          <select
            value={form.vacancyId ?? ""}
            onChange={(e) => set("vacancyId", e.target.value ? Number(e.target.value) : null)}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          >
            <option value="">— none —</option>
            {vacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.company} — {v.position || "Position"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="w-full h-16 mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <div className="flex items-center gap-2 pt-1">
          {editingId && (
            <Btn variant="danger" size="sm" onClick={onDelete} loading={deleting}>
              Delete
            </Btn>
          )}
          <div className="ml-auto flex gap-2">
            <Btn variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Btn>
            <Btn size="sm" disabled={!canSave} loading={saving} onClick={() => onSave(form)}>
              Save
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function CalendarPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(ymd(today));
  const [modal, setModal] = useState<{ editingId: number | null; draft: CalendarEventInput } | null>(null);

  const cells = useMemo(() => buildMonthCells(cursor.year, cursor.month), [cursor]);
  const from = cells[0]!.key;
  const to = cells[cells.length - 1]!.key;

  const { data, isLoading } = useCombinedCalendar({ from, to });
  const addMutation = useAddCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();

  const byDayEvents = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of data?.events ?? []) {
      const key = ymd(new Date(e.startAt));
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    return m;
  }, [data]);
  const byDaySteps = useMemo(() => {
    const m = new Map<string, CalendarVacancyStep[]>();
    for (const s of data?.vacancyNextSteps ?? []) {
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    }
    return m;
  }, [data]);
  const byDayDue = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data?.srsDue ?? []) m.set(d.date, d.count);
    return m;
  }, [data]);

  const goMonth = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const goToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDay(ymd(today));
  };

  const openNew = (day: string) => setModal({ editingId: null, draft: { ...EMPTY_DRAFT, startAt: fromLocalInput(`${day}T09:00`) ?? "" } });
  const openEdit = (e: CalendarEvent) =>
    setModal({
      editingId: e.id,
      draft: { title: e.title, notes: e.notes, startAt: e.startAt, endAt: e.endAt, type: e.type, vacancyId: e.vacancyId },
    });

  const save = (draft: CalendarEventInput) => {
    if (modal?.editingId) {
      updateMutation.mutate({ id: modal.editingId, patch: draft }, { onSuccess: () => setModal(null) });
    } else {
      addMutation.mutate(draft, { onSuccess: () => setModal(null) });
    }
  };
  const doDelete = () => {
    if (!modal?.editingId) return;
    deleteMutation.mutate(modal.editingId, { onSuccess: () => setModal(null) });
  };

  const selectedEvents = (byDayEvents.get(selectedDay) ?? []).sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
  const selectedSteps = byDaySteps.get(selectedDay) ?? [];
  const selectedDue = byDayDue.get(selectedDay) ?? 0;

  if (isLoading) return <CardsSkeleton count={3} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        subtitle="Interviews, calls, deadlines and reminders — plus your vacancies' next steps and SRS due-cards — in one connected view."
        actions={
          <Btn onClick={() => openNew(selectedDay)}>
            <span aria-hidden>+</span> Add event
          </Btn>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Btn variant="ghost" size="sm" aria-label="Previous month" onClick={() => goMonth(-1)}>
            ‹
          </Btn>
          <div className="font-display font-semibold text-ink min-w-[10rem] text-center">
            {MONTH_LABEL.format(new Date(cursor.year, cursor.month, 1))}
          </div>
          <Btn variant="ghost" size="sm" aria-label="Next month" onClick={() => goMonth(1)}>
            ›
          </Btn>
        </div>
        <Btn variant="ghost" size="sm" onClick={goToday}>
          Today
        </Btn>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {CALENDAR_EVENT_TYPES.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-[11px] text-ink-dim">
              <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[t]}`} /> {TYPE_LABEL[t]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-alert" /> Vacancy step
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-dim">🧠 SRS due</span>
        </div>
      </div>

      <Card className="!p-2 md:!p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="font-display text-[11px] font-bold uppercase tracking-wider text-ink-dim text-center py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const events = byDayEvents.get(cell.key) ?? [];
            const steps = byDaySteps.get(cell.key) ?? [];
            const due = byDayDue.get(cell.key) ?? 0;
            const isToday = cell.key === ymd(today);
            const isSelected = cell.key === selectedDay;
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedDay(cell.key)}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${cell.date.toDateString()}${events.length ? `, ${events.length} event(s)` : ""}`}
                className={`relative rounded-lg border p-1.5 text-left min-h-[64px] sm:min-h-[76px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 ${
                  isSelected ? "border-signal bg-signal/10" : "border-grid hover:bg-surface-2"
                } ${cell.inMonth ? "" : "opacity-40"}`}
              >
                <div className={`text-xs font-semibold ${isToday ? "text-signal" : "text-ink"}`}>{cell.date.getDate()}</div>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {events.slice(0, 3).map((e) => (
                    <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[e.type]}`} title={e.title} />
                  ))}
                  {steps.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-alert" title="Vacancy next step" />}
                  {due > 0 && <span className="text-[10px] leading-none text-ink-dim">🧠{due}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="font-display font-semibold text-ink">
            {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${selectedDay}T00:00`))}
          </div>
          <Btn size="sm" variant="ghost" onClick={() => openNew(selectedDay)}>
            + Add
          </Btn>
        </div>

        {selectedSteps.length === 0 && selectedDue === 0 && selectedEvents.length === 0 ? (
          <EmptyState icon="🗓️" title="Nothing on this day" hint="Add an event, or check back once a vacancy step or SRS review is due." />
        ) : (
          <div className="space-y-2">
            {selectedSteps.map((s) => (
              <button
                key={s.vacancyId}
                onClick={() => navigate("/vacancies")}
                className="w-full flex items-center gap-2 text-sm text-left px-2.5 py-2 rounded-lg border border-alert/30 bg-alert/10 hover:bg-alert/20 transition-colors"
              >
                <Chip tone="amber">Next step</Chip>
                <span className="text-ink">
                  {s.company} — <span className="text-ink-dim">{s.position || "Position"}</span>
                </span>
                <span className="ml-auto text-ink-dim text-xs">→ Vacancies</span>
              </button>
            ))}
            {selectedDue > 0 && (
              <button
                onClick={() => navigate("/study")}
                className="w-full flex items-center gap-2 text-sm text-left px-2.5 py-2 rounded-lg border border-signal/30 bg-signal/10 hover:bg-signal/20 transition-colors"
              >
                <span aria-hidden>🧠</span>
                <span className="text-ink">
                  {selectedDue} flashcard{selectedDue === 1 ? "" : "s"} due for review
                </span>
                <span className="ml-auto text-ink-dim text-xs">→ Study</span>
              </button>
            )}
            {selectedEvents.map((e) => {
              const isDeleting = deleteMutation.isPending && deleteMutation.variables === e.id;
              return (
                <div key={e.id} className="flex items-start gap-2 px-2.5 py-2 rounded-lg border border-grid">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[e.type]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-ink">{e.title || "Untitled event"}</span>
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_CHIP[e.type]}`}>
                        {TYPE_LABEL[e.type]}
                      </span>
                    </div>
                    <div className="text-xs text-ink-dim mt-0.5">
                      {TIME_LABEL.format(new Date(e.startAt))}
                      {e.endAt && ` – ${TIME_LABEL.format(new Date(e.endAt))}`}
                    </div>
                    {e.notes && <div className="text-xs text-ink-dim mt-1 whitespace-pre-wrap">{e.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(e)}
                      className="text-xs text-ink-dim hover:text-signal px-1.5 py-1"
                      aria-label={`Edit ${e.title}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(e.id)}
                      disabled={isDeleting}
                      className="text-xs text-ink-dim hover:text-rose-600 px-1.5 py-1 disabled:opacity-50"
                      aria-label={`Delete ${e.title}`}
                    >
                      {isDeleting ? <Spinner className="h-3 w-3" /> : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {modal && (
        <EventModal
          draft={modal.draft}
          editingId={modal.editingId}
          onClose={() => setModal(null)}
          onSave={save}
          onDelete={doDelete}
          saving={addMutation.isPending || updateMutation.isPending}
          deleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
