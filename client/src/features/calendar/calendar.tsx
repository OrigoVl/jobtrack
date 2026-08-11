import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  useCombinedCalendar,
  useAddCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  useContacts,
  useCompanies,
  useVacancies,
} from "../../shared/queries";
import { Btn, Card, CardsSkeleton, EmptyState, PageHeader, Segmented, Spinner } from "../../shared/ui";
import { useUi } from "../../shared/ui-state";
import { useConfirm } from "../../shared/use-confirm";
import { PopoverPanel } from "../../shared/popover";
import { usePopover } from "../../shared/use-popover";
import { CardsStackIcon } from "../../shared/icons";
import { CALENDAR_EVENT_TYPES, type CalendarEvent, type CalendarEventInput, type CalendarVacancyStep } from "../../shared/types";
import { fromLocalInput } from "./calendar-date-utils";
import { buildMonthCells, buildWeekCells, ymd } from "../../shared/calendar-grid";
import { contactLabel, STEP_DOT, TYPE_DOT, TYPE_KEY, type CalendarMarker } from "./calendar-shared";
import { buildUpcoming, moveEventToDay, shiftDay } from "./calendar-agenda";
import { EventModal } from "./event-modal";
import { DayAgenda } from "./day-agenda";
import { UpcomingCard } from "./upcoming-card";
import { AgendaRows } from "./agenda-rows";

const EMPTY_DRAFT: CalendarEventInput = {
  title: "",
  notes: "",
  startAt: "",
  endAt: null,
  type: "other",
  meetingUrl: "",
  vacancyId: null,
  contactId: null,
};
/** Time of day a new event gets when it's created from a day (the popover's quick-add, or the
 * "+ Add" buttons) rather than typed into the full form. */
const DEFAULT_NEW_TIME = "09:00";
/** How far ahead the Upcoming card looks. Its own range, deliberately not the grid's visible
 * month — see UpcomingCard's doc-comment. */
const UPCOMING_DAYS = 60;
/** Event rows drawn inside a day cell before the rest collapse into a "+N more" line — the week
 * view's cells are several times taller, so they show correspondingly more. */
const CELL_EVENT_LIMIT = { month: 2, week: 6 };
/** Upper bound on the list view's rows. High enough that a normal month never hits it, low enough
 * that a pathological calendar can't render thousands of nodes. */
const LIST_LIMIT = 200;

/** Month grid, one week at a time, or a flat chronological list. */
type CalendarView = "month" | "week" | "list";
/** The day popover's own width (matches DayAgenda's `w-[23rem]`) and the height assumed for the
 * FIRST positioning pass only — from the second pass on, usePopover feeds back the panel's real
 * measured height, so a popover that flips above its cell sits exactly on top of it. */
const DAY_POPOVER_WIDTH = 368;
const DAY_POPOVER_HEIGHT_ESTIMATE = 260;

export function CalendarPage() {
  const { t, i18n } = useTranslation(["calendar", "common"]);
  const confirm = useConfirm();
  const navigate = useNavigate();
  const today = new Date();
  const todayKey = ymd(today);
  // useUi, not useState (same convention as the mock-interview screen's options): the chosen view
  // survives navigating to another page and back, which plain component state would not. It is an
  // in-memory store though — a full reload legitimately starts back on Month.
  const [view, setView] = useUi<CalendarView>("calendar.view", "month");
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [modal, setModal] = useState<{ editingId: number | null; draft: CalendarEventInput } | null>(null);
  // Legend entries double as filters; this holds the ones currently switched OFF.
  const [hidden, setHidden] = useState<Set<CalendarMarker>>(new Set());
  // The event being dragged and the day currently under the pointer — the latter only exists to
  // highlight the drop target, since HTML5 drag events give no "where am I" state of their own.
  const [dragging, setDragging] = useState<CalendarEvent | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // One popover serves all 42 cells, so its anchor is assigned imperatively on click rather than
  // attached in JSX (see usePopover's generic anchor).
  const dayPopover = usePopover<HTMLButtonElement>((rect, panelHeight) => {
    const height = panelHeight || DAY_POPOVER_HEIGHT_ESTIMATE;
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - DAY_POPOVER_WIDTH - 8));
    const fitsBelow = rect.bottom + height + 4 <= window.innerHeight;
    const top = fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - height - 4);
    return { top, left };
  });

  // The week view narrows the SAME cell model to seven days around the selection, so the grid
  // below (and its drag/drop, popover and keyboard handling) is shared verbatim between views.
  const cells = useMemo(
    () => (view === "week" ? buildWeekCells(selectedDay) : buildMonthCells(cursor.year, cursor.month)),
    [view, selectedDay, cursor],
  );
  const from = cells[0]!.key;
  const to = cells[cells.length - 1]!.key;

  const monthLabel = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }), [i18n.language]);
  const timeLabel = useMemo(() => new Intl.DateTimeFormat(i18n.language, { hour: "numeric", minute: "2-digit" }), [i18n.language]);
  // Derived from the grid's own first week (guaranteed Monday-first, see calendar-grid.ts)
  // rather than a hardcoded array — can't drift out of sync with the actual layout.
  const weekdayShort = useMemo(() => new Intl.DateTimeFormat(i18n.language, { weekday: "short" }), [i18n.language]);
  const weekdays = useMemo(() => cells.slice(0, 7).map((c) => weekdayShort.format(c.date)), [cells, weekdayShort]);
  // Full weekday/month/day, used both for each day cell's accessible name and the popover heading
  // — locale-aware (not hardcoded "en-US" like this used to be).
  const fullDateLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    [i18n.language],
  );

  // `isPlaceholderData` (not `isLoading`) drives the busy indicator below: with placeholderData the
  // previous month's grid stays on screen while the next one loads, instead of the whole page
  // being replaced by a skeleton on every ‹ / › click.
  // Two formatters, not one Intl range formatter: `formatRange` needs the ES2021 Intl lib, which
  // this workspace's tsconfig deliberately doesn't pull in. Only the SECOND date carries the year,
  // so both locales read naturally ("Aug 10 – Aug 16, 2026" / "10 серп. – 16 серп. 2026 р.")
  // instead of the year dangling after a month-first date.
  const rangeStartLabel = useMemo(() => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" }), [i18n.language]);
  const rangeEndLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", year: "numeric" }),
    [i18n.language],
  );
  /** "August 2026" for the month/list views, the week's date range for the week view. */
  const periodLabel =
    view === "week" && cells.length
      ? `${rangeStartLabel.format(cells[0]!.date)} – ${rangeEndLabel.format(cells[cells.length - 1]!.date)}`
      : monthLabel.format(new Date(cursor.year, cursor.month, 1));

  const { data, isLoading, isPlaceholderData } = useCombinedCalendar({ from, to }, { keepPrevious: true });
  const upcomingRange = useMemo(() => ({ from: todayKey, to: shiftDay(todayKey, UPCOMING_DAYS) }), [todayKey]);
  const { data: upcomingData } = useCombinedCalendar(upcomingRange);
  const { data: contacts = [] } = useContacts();
  const { data: companies = [] } = useCompanies();
  const { data: vacancies = [] } = useVacancies();
  const addMutation = useAddCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();

  const visibleEvents = useMemo(() => (data?.events ?? []).filter((e) => !hidden.has(e.type)), [data, hidden]);
  const byDayEvents = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of visibleEvents) {
      const key = ymd(new Date(e.startAt));
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
    return m;
  }, [visibleEvents]);
  const byDaySteps = useMemo(() => {
    const m = new Map<string, CalendarVacancyStep[]>();
    if (hidden.has("vacancyStep")) return m;
    for (const s of data?.vacancyNextSteps ?? []) {
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    }
    return m;
  }, [data, hidden]);
  const byDayDue = useMemo(() => {
    const m = new Map<string, number>();
    if (hidden.has("srsDue")) return m;
    for (const d of data?.srsDue ?? []) m.set(d.date, d.count);
    return m;
  }, [data, hidden]);

  /** ‹ / › move by whatever period is on screen: a month in the month/list views, a week in the
   * week view (where paging by month would skip 3 of every 4 screens). */
  const goPeriod = (delta: number) => {
    if (view === "week") {
      const next = shiftDay(selectedDay, delta * 7);
      const d = new Date(`${next}T00:00`);
      setSelectedDay(next);
      setCursor({ year: d.getFullYear(), month: d.getMonth() });
      return;
    }
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };
  const goToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDay(todayKey);
  };

  /** Switching views keeps the SAME day in view rather than jumping home: month → week shows the
   * week around the selection, week → month the month it falls in. */
  const switchView = (next: CalendarView) => {
    if (next === "week") {
      const inCursorMonth = new Date(`${selectedDay}T00:00`).getMonth() === cursor.month;
      if (!inCursorMonth) setSelectedDay(ymd(new Date(cursor.year, cursor.month, 1)));
    } else if (view === "week") {
      const d = new Date(`${selectedDay}T00:00`);
      setCursor({ year: d.getFullYear(), month: d.getMonth() });
    }
    setView(next);
  };

  const openNew = (day: string) => {
    dayPopover.setOpen(false);
    setModal({ editingId: null, draft: { ...EMPTY_DRAFT, startAt: fromLocalInput(`${day}T${DEFAULT_NEW_TIME}`) ?? "" } });
  };
  const openEdit = (e: CalendarEvent) => {
    dayPopover.setOpen(false);
    setModal({
      editingId: e.id,
      draft: {
        title: e.title,
        notes: e.notes,
        startAt: e.startAt,
        endAt: e.endAt,
        type: e.type,
        meetingUrl: e.meetingUrl,
        vacancyId: e.vacancyId,
        contactId: e.contactId,
      },
    });
  };

  const save = (draft: CalendarEventInput) => {
    if (modal?.editingId) {
      updateMutation.mutate({ id: modal.editingId, patch: draft }, { onSuccess: () => setModal(null) });
    } else {
      addMutation.mutate(draft, { onSuccess: () => setModal(null) });
    }
  };
  const doDelete = async () => {
    if (!modal?.editingId) return;
    if (!(await confirm({ title: t("deleteConfirmTitle", { title: modal.draft.title || t("common:actions.delete") }) }))) return;
    deleteMutation.mutate(modal.editingId, { onSuccess: () => setModal(null) });
  };
  const deleteEvent = async (e: CalendarEvent) => {
    // The popover closes FIRST: its panel is z-[75], deliberately above the confirm dialog's
    // z-[70] (see popover.tsx — a popover has to be usable from inside a modal), so a confirm
    // raised from inside the popover would open behind it with its buttons unreachable.
    dayPopover.setOpen(false);
    if (await confirm({ title: t("deleteConfirmTitle", { title: e.title }) })) deleteMutation.mutate(e.id);
  };
  const quickAdd = (day: string, title: string) =>
    addMutation.mutate({ ...EMPTY_DRAFT, title, startAt: fromLocalInput(`${day}T${DEFAULT_NEW_TIME}`) ?? "" });

  /** Focuses a day cell after the arrow keys move the selection — the grid is a single tab stop
   * (roving tabindex), so the browser needs telling where focus went. */
  const focusDay = (day: string) => {
    setSelectedDay(day);
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus());
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const delta = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -7 : e.key === "ArrowDown" ? 7 : 0;
    if (!delta) return;
    e.preventDefault(); // otherwise the page scrolls instead of the selection moving
    const next = shiftDay(selectedDay, delta);
    // Following the selection out of the visible month pages the grid, like every calendar does.
    const nextDate = new Date(`${next}T00:00`);
    if (nextDate.getMonth() !== cursor.month || nextDate.getFullYear() !== cursor.year) {
      setCursor({ year: nextDate.getFullYear(), month: nextDate.getMonth() });
    }
    focusDay(next);
  };

  const openDay = (day: string, anchor: HTMLButtonElement) => {
    // Clicking the day that's already showing its popover closes it again — the cell is the
    // popover's own toggle, so there's no need to aim for an empty spot to dismiss it.
    if (dayPopover.open && day === selectedDay) {
      dayPopover.setOpen(false);
      return;
    }
    setSelectedDay(day);
    dayPopover.anchorRef.current = anchor;
    dayPopover.setOpen(true);
  };

  const dropOnDay = (day: string) => {
    const event = dragging;
    setDragging(null);
    setDropDay(null);
    if (!event) return;
    const moved = moveEventToDay(event, day);
    if (!moved) return;
    updateMutation.mutate({
      id: event.id,
      patch: { ...moved, title: event.title, notes: event.notes, type: event.type, vacancyId: event.vacancyId },
    });
  };

  const toggleFilter = (marker: CalendarMarker) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(marker)) next.add(marker);
      return next;
    });

  // The list view is the same filtered data as the grid, flattened chronologically across the
  // whole visible range (from its first day, so it also covers the days already past this month).
  const listItems = useMemo(
    () => buildUpcoming(visibleEvents, [...byDaySteps.values()].flat(), from, LIST_LIMIT),
    [visibleEvents, byDaySteps, from],
  );

  const popoverDay = selectedDay;
  const popoverEvents = byDayEvents.get(popoverDay) ?? [];

  if (isLoading) return <CardsSkeleton count={3} />;

  const legendEntries: { marker: CalendarMarker; dot: string; label: string }[] = [
    ...CALENDAR_EVENT_TYPES.map((ty) => ({ marker: ty as CalendarMarker, dot: TYPE_DOT[ty], label: t(TYPE_KEY[ty]) })),
    { marker: "vacancyStep", dot: STEP_DOT, label: t("legend.vacancyStep") },
    { marker: "srsDue", dot: "bg-signal", label: t("legend.srsDue") },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("eyebrow")}
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
          <Btn variant="ghost" size="sm" aria-label={t("previousPeriod")} onClick={() => goPeriod(-1)}>
            ‹
          </Btn>
          <div className="font-display font-semibold text-ink min-w-[10rem] text-center">{periodLabel}</div>
          <Btn variant="ghost" size="sm" aria-label={t("nextPeriod")} onClick={() => goPeriod(1)}>
            ›
          </Btn>
        </div>
        <Btn variant="ghost" size="sm" onClick={goToday}>
          {t("today")}
        </Btn>
        <Segmented
          value={view}
          onChange={switchView}
          options={[
            { value: "month", label: t("view.month") },
            { value: "week", label: t("view.week") },
            { value: "list", label: t("view.list") },
          ]}
        />
        {isPlaceholderData && <Spinner className="h-3.5 w-3.5 text-ink-dim" />}
        {/* The legend doubles as a filter bar: each entry toggles its own marker off the grid. */}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {legendEntries.map(({ marker, dot, label }) => {
            const off = hidden.has(marker);
            return (
              <button
                key={marker}
                type="button"
                aria-pressed={!off}
                onClick={() => toggleFilter(marker)}
                title={t("legend.toggleHint")}
                className={`inline-flex items-center gap-1 text-[11px] rounded-full border px-2 py-0.5 transition-colors ${
                  off ? "border-grid text-ink-dim/50 line-through" : "border-grid text-ink-dim hover:bg-surface-2"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dot} ${off ? "opacity-40" : ""}`} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {view === "list" ? (
        <Card>
          {listItems.length === 0 ? (
            <EmptyState title={t("list.emptyTitle")} hint={t("list.emptyHint")} />
          ) : (
            <AgendaRows items={listItems} onOpenEvent={openEdit} onGoVacancies={() => navigate("/vacancies")} />
          )}
        </Card>
      ) : (
        <Card className="!p-2 md:!p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdays.map((w) => (
              <div key={w} className="eyebrow text-ink-dim text-center py-1">
                {w}
              </div>
            ))}
          </div>
          {/* Deliberately NOT role="grid"/"gridcell": a conformant ARIA grid needs role="row"
            wrappers, which this flat 42-child CSS grid doesn't have (and adding them would break
            the `grid-cols-7` layout). Arrow keys are handled on the day buttons themselves (the
            only thing that can hold focus here), not on this container. */}
          <div ref={gridRef} className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const events = byDayEvents.get(cell.key) ?? [];
              const steps = byDaySteps.get(cell.key) ?? [];
              const due = byDayDue.get(cell.key) ?? 0;
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedDay;
              const isPast = cell.key < todayKey;
              const isDropTarget = dropDay === cell.key;
              return (
                <div
                  key={cell.key}
                  onDragOver={(e) => {
                    if (!dragging) return;
                    e.preventDefault(); // without this the browser refuses the drop entirely
                    setDropDay(cell.key);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropOnDay(cell.key);
                  }}
                  className={`relative rounded-lg border p-1.5 transition-colors ${
                    view === "week" ? "min-h-[180px]" : "min-h-[84px] sm:min-h-[96px]"
                  } ${
                    isDropTarget
                      ? "border-signal bg-signal/20"
                      : isSelected
                        ? "border-signal bg-signal/10"
                        : "border-grid hover:bg-surface-2"
                  } ${cell.inMonth ? "" : "opacity-40"} ${isPast && !isSelected ? "bg-surface-2/40" : ""}`}
                >
                  {/* The cell's own click target sits BEHIND the event rows (absolute inset + -z),
                    so a cell is clickable everywhere without nesting buttons inside a button —
                    which is invalid HTML and breaks the event rows' own clicks. */}
                  <button
                    type="button"
                    data-day={cell.key}
                    tabIndex={isSelected ? 0 : -1}
                    onKeyDown={onGridKeyDown}
                    onClick={(e) => openDay(cell.key, e.currentTarget)}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={
                      events.length
                        ? t("dayAriaLabel", { date: fullDateLabel.format(cell.date), count: events.length })
                        : t("dayAriaLabelNoEvents", { date: fullDateLabel.format(cell.date) })
                    }
                    className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
                  />
                  <div className="relative pointer-events-none space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-semibold ${
                          isToday
                            ? "grid place-items-center h-5 w-5 rounded-full bg-star text-on-signal"
                            : isPast
                              ? "text-ink-dim"
                              : "text-ink"
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {steps.length > 0 && <span className={`w-1.5 h-1.5 rounded-full ${STEP_DOT}`} title={t("legend.vacancyStep")} />}
                      {due > 0 && (
                        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] leading-none text-ink-dim">
                          <CardsStackIcon className="h-2.5 w-2.5" />
                          {due}
                        </span>
                      )}
                    </div>
                    {events.slice(0, CELL_EVENT_LIMIT[view === "week" ? "week" : "month"]).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        // Not a tab stop: the grid is one roving-tabindex control, and every event
                        // is reachable from the day popover that Enter opens.
                        tabIndex={-1}
                        draggable
                        onDragStart={() => setDragging(e)}
                        onDragEnd={() => {
                          setDragging(null);
                          setDropDay(null);
                        }}
                        onClick={() => openEdit(e)}
                        title={e.title}
                        className="pointer-events-auto w-full flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight text-left hover:bg-surface-2 cursor-grab active:cursor-grabbing"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[e.type]}`} />
                        <span className="text-ink-dim shrink-0">{timeLabel.format(new Date(e.startAt))}</span>
                        <span className="text-ink truncate">{e.title || t("untitledEvent")}</span>
                      </button>
                    ))}
                    {events.length > CELL_EVENT_LIMIT[view === "week" ? "week" : "month"] && (
                      <div className="px-1 text-[10px] text-ink-dim">
                        {t("moreEvents", { count: events.length - CELL_EVENT_LIMIT[view === "week" ? "week" : "month"] })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* The list view IS an agenda, so a second one below it would just repeat itself. */}
      {view !== "list" && (
        <UpcomingCard
          events={upcomingData?.events ?? []}
          steps={upcomingData?.vacancyNextSteps ?? []}
          fromDay={todayKey}
          onOpenEvent={openEdit}
          onGoVacancies={() => navigate("/vacancies")}
        />
      )}

      <PopoverPanel
        open={dayPopover.open}
        panelRef={dayPopover.panelRef}
        coords={dayPopover.coords}
        onClose={() => dayPopover.setOpen(false)}
      >
        <DayAgenda
          dayLabel={fullDateLabel.format(new Date(`${popoverDay}T00:00`))}
          timeLabel={timeLabel}
          events={popoverEvents}
          steps={byDaySteps.get(popoverDay) ?? []}
          srsDue={byDayDue.get(popoverDay) ?? 0}
          deletingId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
          quickAdding={addMutation.isPending}
          contactName={(id) => {
            const contact = contacts.find((c) => c.id === id);
            return contact && contactLabel(contact, companies, vacancies);
          }}
          onAddFull={() => openNew(popoverDay)}
          onEdit={openEdit}
          onDelete={deleteEvent}
          onQuickAdd={(title) => quickAdd(popoverDay, title)}
          onGoVacancies={() => navigate("/vacancies")}
          onGoStudy={() => navigate("/study")}
        />
      </PopoverPanel>

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
