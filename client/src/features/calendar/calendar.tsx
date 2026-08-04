import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { fromLocalInput, toLocalInput } from "./calendar-date-utils";
import { buildMonthCells, ymd } from "../../shared/calendar-grid";

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
// A Record (not a template literal) so each value stays a literal key i18next's typed t() can
// verify against calendar.json — same trick as shared/fit-tone.ts's FIT_KEY, for the same reason.
const TYPE_KEY: Record<
  CalendarEventType,
  "eventType.interview" | "eventType.call" | "eventType.deadline" | "eventType.reminder" | "eventType.other"
> = {
  interview: "eventType.interview",
  call: "eventType.call",
  deadline: "eventType.deadline",
  reminder: "eventType.reminder",
  other: "eventType.other",
};
// Month/weekday/time labels follow the app's active language (i18n.language) — computed inside
// CalendarPage below via useMemo, not as module-level constants like these used to be, since
// they now depend on a value that can change at runtime (see shared/calendar-panel.tsx for the
// same pattern and the reasoning: this must track the chosen app language, not navigator/OS locale).

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
  const { t } = useTranslation(["calendar", "common"]);
  const [form, setForm] = useState(draft);
  const { data: vacancies = [] } = useVacancies();
  const set = <K extends keyof CalendarEventInput>(k: K, v: CalendarEventInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.title.trim().length > 0 && form.startAt.length > 0;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-label={t("common:actions.close")} onClick={onClose} className="fixed inset-0 bg-ink/50 cursor-default" />
      <Card className="relative w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="font-display font-semibold text-ink">{editingId ? t("modal.editEvent") : t("modal.newEvent")}</div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.titleLabel")}</span>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={t("modal.titlePlaceholder")}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">{t("modal.starts")}</span>
            <DateTimeInput
              value={toLocalInput(form.startAt)}
              onChange={(local) => set("startAt", fromLocalInput(local) ?? "")}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">{t("modal.endsOptional")}</span>
            <DateTimeInput
              value={toLocalInput(form.endAt)}
              onChange={(local) => set("endAt", fromLocalInput(local))}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.type")}</span>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value as CalendarEventType)}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          >
            {CALENDAR_EVENT_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(TYPE_KEY[ty])}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.linkedVacancy")}</span>
          <select
            value={form.vacancyId ?? ""}
            onChange={(e) => set("vacancyId", e.target.value ? Number(e.target.value) : null)}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          >
            <option value="">{t("modal.none")}</option>
            {vacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.company} — {v.position || t("modal.position")}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.notes")}</span>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="w-full h-16 mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <div className="flex items-center gap-2 pt-1">
          {editingId && (
            <Btn variant="danger" size="sm" onClick={onDelete} loading={deleting}>
              {t("common:actions.delete")}
            </Btn>
          )}
          <div className="ml-auto flex gap-2">
            <Btn variant="ghost" size="sm" onClick={onClose}>
              {t("common:actions.cancel")}
            </Btn>
            <Btn size="sm" disabled={!canSave} loading={saving} onClick={() => onSave(form)}>
              {t("common:actions.save")}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function CalendarPage() {
  const { t, i18n } = useTranslation(["calendar", "common"]);
  const navigate = useNavigate();
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(ymd(today));
  const [modal, setModal] = useState<{ editingId: number | null; draft: CalendarEventInput } | null>(null);

  const cells = useMemo(() => buildMonthCells(cursor.year, cursor.month), [cursor]);
  const from = cells[0]!.key;
  const to = cells[cells.length - 1]!.key;

  const monthLabel = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }), [i18n.language]);
  const timeLabel = useMemo(() => new Intl.DateTimeFormat(i18n.language, { hour: "numeric", minute: "2-digit" }), [i18n.language]);
  // Derived from the grid's own first week (guaranteed Monday-first, see calendar-grid.ts)
  // rather than a hardcoded array — can't drift out of sync with the actual layout.
  const weekdayShort = useMemo(() => new Intl.DateTimeFormat(i18n.language, { weekday: "short" }), [i18n.language]);
  const weekdays = useMemo(() => cells.slice(0, 7).map((c) => weekdayShort.format(c.date)), [cells, weekdayShort]);
  // Full weekday/month/day, used both for each day cell's accessible name and the selected-day
  // heading below — locale-aware (not hardcoded "en-US" like this used to be).
  const fullDateLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    [i18n.language],
  );
  const selectedDayLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: "long", month: "long", day: "numeric" }),
    [i18n.language],
  );

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
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Btn onClick={() => openNew(selectedDay)}>
            <span aria-hidden>+</span> {t("addEvent")}
          </Btn>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Btn variant="ghost" size="sm" aria-label={t("common:dateInput.previousMonth")} onClick={() => goMonth(-1)}>
            ‹
          </Btn>
          <div className="font-display font-semibold text-ink min-w-[10rem] text-center">
            {monthLabel.format(new Date(cursor.year, cursor.month, 1))}
          </div>
          <Btn variant="ghost" size="sm" aria-label={t("common:dateInput.nextMonth")} onClick={() => goMonth(1)}>
            ›
          </Btn>
        </div>
        <Btn variant="ghost" size="sm" onClick={goToday}>
          {t("today")}
        </Btn>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {CALENDAR_EVENT_TYPES.map((ty) => (
            <span key={ty} className="inline-flex items-center gap-1 text-[11px] text-ink-dim">
              <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[ty]}`} /> {t(TYPE_KEY[ty])}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-alert" /> {t("legend.vacancyStep")}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-dim">🧠 {t("legend.srsDue")}</span>
        </div>
      </div>

      <Card className="!p-2 md:!p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdays.map((w) => (
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
                aria-label={
                  events.length
                    ? t("dayAriaLabel", { date: fullDateLabel.format(cell.date), count: events.length })
                    : t("dayAriaLabelNoEvents", { date: fullDateLabel.format(cell.date) })
                }
                className={`relative rounded-lg border p-1.5 text-left min-h-[64px] sm:min-h-[76px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 ${
                  isSelected ? "border-signal bg-signal/10" : "border-grid hover:bg-surface-2"
                } ${cell.inMonth ? "" : "opacity-40"}`}
              >
                <div className={`text-xs font-semibold ${isToday ? "text-signal" : "text-ink"}`}>{cell.date.getDate()}</div>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {events.slice(0, 3).map((e) => (
                    <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[e.type]}`} title={e.title} />
                  ))}
                  {steps.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-alert" title={t("legend.vacancyStep")} />}
                  {due > 0 && <span className="text-[10px] leading-none text-ink-dim">🧠{due}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="font-display font-semibold text-ink">{selectedDayLabel.format(new Date(`${selectedDay}T00:00`))}</div>
          <Btn size="sm" variant="ghost" onClick={() => openNew(selectedDay)}>
            {t("addEventShort")}
          </Btn>
        </div>

        {selectedSteps.length === 0 && selectedDue === 0 && selectedEvents.length === 0 ? (
          <EmptyState icon="🗓️" title={t("empty.title")} hint={t("empty.hint")} />
        ) : (
          <div className="space-y-2">
            {selectedSteps.map((s) => (
              <button
                key={s.vacancyId}
                onClick={() => navigate("/vacancies")}
                className="w-full flex items-center gap-2 text-sm text-left px-2.5 py-2 rounded-lg border border-alert/30 bg-alert/10 hover:bg-alert/20 transition-colors"
              >
                <Chip tone="amber">{t("nextStep")}</Chip>
                <span className="text-ink">
                  {s.company} — <span className="text-ink-dim">{s.position || t("modal.position")}</span>
                </span>
                <span className="ml-auto text-ink-dim text-xs">{t("goToVacancies")}</span>
              </button>
            ))}
            {selectedDue > 0 && (
              <button
                onClick={() => navigate("/study")}
                className="w-full flex items-center gap-2 text-sm text-left px-2.5 py-2 rounded-lg border border-signal/30 bg-signal/10 hover:bg-signal/20 transition-colors"
              >
                <span aria-hidden>🧠</span>
                <span className="text-ink">{t("flashcardsDue", { count: selectedDue })}</span>
                <span className="ml-auto text-ink-dim text-xs">{t("goToStudy")}</span>
              </button>
            )}
            {selectedEvents.map((e) => {
              const isDeleting = deleteMutation.isPending && deleteMutation.variables === e.id;
              return (
                <div key={e.id} className="flex items-start gap-2 px-2.5 py-2 rounded-lg border border-grid">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[e.type]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-ink">{e.title || t("untitledEvent")}</span>
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_CHIP[e.type]}`}>
                        {t(TYPE_KEY[e.type])}
                      </span>
                    </div>
                    <div className="text-xs text-ink-dim mt-0.5">
                      {timeLabel.format(new Date(e.startAt))}
                      {e.endAt && ` – ${timeLabel.format(new Date(e.endAt))}`}
                    </div>
                    {e.notes && <div className="text-xs text-ink-dim mt-1 whitespace-pre-wrap">{e.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(e)}
                      className="text-xs text-ink-dim hover:text-signal px-1.5 py-1"
                      aria-label={t("editAriaLabel", { title: e.title })}
                    >
                      {t("common:actions.edit")}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(e.id)}
                      disabled={isDeleting}
                      className="text-xs text-ink-dim hover:text-rose-600 px-1.5 py-1 disabled:opacity-50"
                      aria-label={t("deleteAriaLabel", { title: e.title })}
                    >
                      {isDeleting ? <Spinner className="h-3 w-3" /> : t("common:actions.delete")}
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
