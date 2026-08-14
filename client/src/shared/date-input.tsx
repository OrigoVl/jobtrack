import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPanel } from "./calendar-panel";
import { usePopover, type PopoverCoords } from "./use-popover";
import { PopoverPanel } from "./popover";
import { CalendarIcon } from "./icons";

// Matches CalendarPanel's own `w-64` / rough rendered height — used only to keep the popover
// inside the viewport (see useCalendarPopover below), not for layout.
const PANEL_WIDTH = 256;
const PANEL_HEIGHT_ESTIMATE = 280;

/** Formats an ISO "yyyy-mm-dd" date as "dd/mm/yyyy" for display. Empty/invalid input → "". */
function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/** Parses a "dd/mm/yyyy" display string into an ISO "yyyy-mm-dd" date, or null if incomplete/invalid
 * (including out-of-range months/days — a masked text input can't stop someone from typing "40/13/2026"). */
function displayToIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const [, d, mo, y] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** Re-applies "dd/mm/yyyy" slashes as the user types/deletes digits, capping at 8 digits total. */
function maskDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

/** Positioning rules for the calendar-icon picker shared by DateInput/DateTimeInput, on top of
 * shared/popover.tsx's generic anchored-popover plumbing: clamps horizontally to the viewport,
 * and flips above the input when there isn't room below — both matter most when the input lives
 * inside a narrow, horizontally-scrolling table column (e.g. Vacancies' Applied/Next-step columns,
 * or the Kanban board). */
function useCalendarPopover() {
  // `panelHeight` is the panel's real measured height once it has rendered (0 on the first pass of
  // an open cycle, hence the estimate as a fallback) — with it, a picker that has to flip above
  // its field lands exactly on top of it instead of wherever the guess put it.
  return usePopover((rect, panelHeight) => {
    const height = panelHeight || PANEL_HEIGHT_ESTIMATE;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8);
    const fitsBelow = rect.bottom + height + 4 <= window.innerHeight;
    const top = fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - height - 4);
    return { top, left };
  });
}

/**
 * Opening the picker by clicking the FIELD, not only the little calendar icon. A date field looks
 * clickable everywhere, so aiming for a 16px icon to get a calendar is a hit-target most people
 * don't discover — clicking the text just put a caret in it and nothing appeared to happen.
 *
 * `onClick`, deliberately not `onFocus`: these fields sit in dense table rows (Vacancies' Applied
 * / Next-step columns), and opening on focus would fire a calendar at every tab stop while
 * keyboard-navigating past them. Keyboard users reach the picker through the icon button, which is
 * focusable and labelled.
 *
 * Opens rather than toggles, so clicking the text again to reposition the caret doesn't dismiss
 * the panel underneath. Closing is Escape, an outside click, picking a day, or the icon.
 */
const openPickerOnClick = (setOpen: (v: boolean) => void) => () => setOpen(true);

/** The small calendar-icon toggle button glued to the right edge of the input, plus the popover panel (see
 * shared/popover.tsx) around `children` (the CalendarPanel) once open. */
function PickerButton({
  open,
  setOpen,
  panelRef,
  coords,
  children,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  panelRef: RefObject<HTMLDivElement | null>;
  coords: PopoverCoords;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        aria-label={t("dateInput.openCalendar")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink leading-none"
      >
        <CalendarIcon className="h-4 w-4" />
      </button>
      <PopoverPanel open={open} panelRef={panelRef} coords={coords} onClose={() => setOpen(false)}>
        {children}
      </PopoverPanel>
    </>
  );
}

/**
 * A locale-independent replacement for `<input type="date">`. Native date inputs render in the
 * OS/browser locale regardless of the page's language (a US-locale OS shows mm/dd/yyyy even
 * inside this UI, and `lang` on the element isn't reliably honored across browsers) — this
 * always displays and accepts "dd/mm/yyyy" (day first, the order this app's users read dates in),
 * and stores/emits the value as ISO "yyyy-mm-dd" (what the API and analytics expect). Clicking
 * the field (or the calendar icon) opens a month-grid popover (CalendarPanel) for picking a day
 * visually, on top of typing.
 */
export function DateInput({
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  "aria-label"?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => isoToDisplay(value));
  const { open, setOpen, anchorRef, panelRef, coords } = useCalendarPopover();

  // Keep the field in sync when the saved value changes from elsewhere (e.g. another tab, or a
  // parent re-render after the mutation settles) — but only while the user isn't actively editing.
  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  function commit(nextText: string) {
    if (!nextText) {
      onChange("");
      return;
    }
    const iso = displayToIso(nextText);
    if (iso) onChange(iso);
  }

  return (
    <div ref={anchorRef} className="relative inline-block w-full">
      <input
        type="text"
        inputMode="numeric"
        // The dd/mm/yyyy digit ORDER is deliberately locale-invariant (see the file doc-comment
        // below) — the placeholder text is wired through i18n so it CAN differ, but both locales
        // currently keep it identical on purpose: showing a different order here without also
        // changing what maskDigits/displayToIso actually accept would mislead, not help.
        placeholder={t("dateInput.datePlaceholder")}
        value={text}
        aria-label={ariaLabel}
        className={`${className ?? ""} pr-7`}
        onClick={openPickerOnClick(setOpen)}
        onChange={(e) => {
          const masked = maskDigits(e.target.value);
          setText(masked);
          // Auto-save the moment a full date has been typed (mirroring the immediate-commit feel
          // of picking a date from a native calendar), and immediately clear when the field is
          // emptied out — no separate "save" step needed either way.
          if (!masked || /^\d{2}\/\d{2}\/\d{4}$/.test(masked)) commit(masked);
        }}
        onBlur={() => {
          // Leaving the field with a partial/invalid date discards it back to the last saved
          // value instead of silently sending garbage to the API.
          if (text && !displayToIso(text)) setText(isoToDisplay(value));
          if (!text) commit("");
        }}
      />
      <PickerButton open={open} setOpen={setOpen} panelRef={panelRef} coords={coords}>
        <CalendarPanel
          selected={value}
          onSelect={(day) => {
            setText(isoToDisplay(day));
            onChange(day);
          }}
        />
      </PickerButton>
    </div>
  );
}

/** Formats a local "yyyy-MM-ddTHH:mm" (the value shape `<input type="datetime-local">` uses) as
 * "dd/mm/yyyy, HH:mm" for display. Empty/invalid input → "". */
function localToDisplay(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return "";
  const [, y, mo, d, h, mi] = m;
  return `${d}/${mo}/${y}, ${h}:${mi}`;
}

/** Parses a "dd/mm/yyyy, HH:mm" display string into a local "yyyy-MM-ddTHH:mm" string, or null if
 * incomplete/invalid. */
function displayToLocal(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})$/.exec(display);
  if (!m) return null;
  const [, d, mo, y, h, mi] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || Number(h) > 23 || Number(mi) > 59) return null;
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

/** Re-applies "dd/mm/yyyy, HH:mm" separators as the user types/deletes digits, capping at 12
 * digits total (DDMMYYYYHHmm). */
function maskDateTimeDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  const d = digits.slice(0, 2);
  const mo = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  const h = digits.slice(8, 10);
  const mi = digits.slice(10, 12);
  let out = d;
  if (mo) out += `/${mo}`;
  if (y) out += `/${y}`;
  if (h) out += `, ${h}`;
  if (mi) out += `:${mi}`;
  return out;
}

/** Default time of day filled in when picking a day from the calendar popover on a field that
 * doesn't have one yet — mid-morning, a reasonable default for scheduling an interview/call. */
const DEFAULT_PICKED_TIME = "09:00";

/** The time-of-day choices offered by DateTimeInput's second picker step: every half hour of the
 * day. Half-hour granularity keeps the list short enough to scan; an odd time (14:15) is still
 * typeable in the field itself, which stays a plain text input. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

/** Minutes since midnight of an "HH:mm" string, or null when it isn't one. */
function minutesOfDay(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Step 2 of DateTimeInput's picker: a scrollable list of half-hour slots for the day already
 * chosen in step 1. Opens scrolled to the current value (or the nearest slot to it, since a
 * hand-typed 14:15 isn't in the list) rather than at 00:00, so the times someone actually
 * schedules things at aren't three scrolls away.
 *
 * The back arrow carries `data-keep-open` (PopoverPanel closes on any click that isn't inside one)
 * — the time buttons deliberately don't, so picking a time closes the whole popover, which is the
 * end of the flow.
 */
function TimePanel({
  dayLabel,
  selected,
  onBack,
  onSelect,
}: {
  /** Human-readable label for the day picked in step 1, shown as the panel's header. */
  dayLabel: string;
  /** Currently selected "HH:mm", or "" if none. */
  selected: string;
  onBack: () => void;
  onSelect: (time: string) => void;
}) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const initialRef = useRef<HTMLButtonElement>(null);
  // Index to start scrolled at: the exact match if the value is on a half hour, otherwise the
  // closest slot; with no value at all, the default the calendar step would have filled in.
  const scrollToIndex = useMemo(() => {
    const target = minutesOfDay(selected || DEFAULT_PICKED_TIME) ?? 0;
    return Math.round(target / 30);
  }, [selected]);

  // ON MOUNT ONLY, and by setting the list's own scrollTop rather than via a `ref` callback +
  // scrollIntoView. Both details are load-bearing: the panel re-renders on every scroll event
  // (usePopover repositions on a capture-phase window scroll listener), so a ref callback would
  // re-run and yank the list back to the initial time the instant the user scrolled it — the list
  // looked frozen. scrollIntoView would additionally scroll the ANCESTOR page/modal behind the
  // portaled panel, not just this list.
  useEffect(() => {
    const list = listRef.current;
    const item = initialRef.current;
    if (!list || !item) return;
    list.scrollTop += item.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientHeight / 2 + item.offsetHeight / 2;
  }, []);

  return (
    <div className="w-64 p-2">
      <div className="flex items-center gap-1 mb-2">
        <button
          type="button"
          data-keep-open
          aria-label={t("dateInput.backToCalendar")}
          onClick={onBack}
          className="w-7 h-7 shrink-0 grid place-items-center rounded-lg text-ink-dim hover:bg-surface-2 hover:text-ink"
        >
          ‹
        </button>
        <span className="text-xs font-semibold text-ink truncate">{dayLabel}</span>
      </div>
      <div ref={listRef} className="grid grid-cols-3 gap-0.5 max-h-56 overflow-y-auto overscroll-contain">
        {TIME_OPTIONS.map((time, i) => (
          <button
            key={time}
            type="button"
            ref={i === scrollToIndex ? initialRef : undefined}
            onClick={() => onSelect(time)}
            className={`h-7 rounded-lg text-xs ${
              time === selected ? "bg-star text-on-signal font-semibold" : "text-ink hover:bg-surface-2"
            }`}
          >
            {time}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A locale-independent replacement for `<input type="datetime-local">`, for the same reason as
 * `DateInput` above (the OS locale, not the page's, decides what a native field renders, and
 * `lang` on the element isn't reliably honored across browsers). Value/onChange
 * use the same local "yyyy-MM-ddTHH:mm" string a native `datetime-local` input's `value`/
 * `e.target.value` would — a drop-in replacement for call sites already using
 * `toLocalInput`/`fromLocalInput` (see `calendar-date-utils.ts`).
 *
 * Clicking the field (or the calendar icon) opens a TWO-STEP popover: the same month-grid as
 * DateInput, then — once a day is picked — a list of half-hour slots for that day, which is what
 * closes the popover. The time used to be typed by hand while only the date was pickable, so
 * scheduling anything meant switching from clicking to counting digits mid-flow. The day is
 * committed as soon as it's clicked (with the existing/default time), so backing out at the time
 * step still leaves the date change saved.
 */
export function DateTimeInput({
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: {
  value: string;
  onChange: (local: string) => void;
  "aria-label"?: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState(() => localToDisplay(value));
  const { open, setOpen, anchorRef, panelRef, coords } = useCalendarPopover();
  // Which step the open popover is showing, and the day it's picking a time FOR — tracked here
  // rather than read back off `value` so the time step still works if a parent doesn't echo the
  // day back synchronously.
  const [step, setStep] = useState<"date" | "time">("date");
  const [pickedDay, setPickedDay] = useState("");

  const dayLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: "short", month: "long", day: "numeric" }),
    [i18n.language],
  );

  useEffect(() => {
    setText(localToDisplay(value));
  }, [value]);

  // Every open starts back at the calendar — the two steps are one flow, not a remembered tab.
  const setPickerOpen = (next: boolean) => {
    if (next) setStep("date");
    setOpen(next);
  };

  function commit(nextText: string) {
    if (!nextText) {
      onChange("");
      return;
    }
    const local = displayToLocal(nextText);
    if (local) onChange(local);
  }

  return (
    <div ref={anchorRef} className="relative inline-block w-full">
      <input
        type="text"
        inputMode="numeric"
        // See DateInput's identical comment above — the digit order is deliberately
        // locale-invariant, only the label text is wired through i18n.
        placeholder={t("dateInput.dateTimePlaceholder")}
        value={text}
        aria-label={ariaLabel}
        className={`${className ?? ""} pr-7`}
        onClick={openPickerOnClick(setPickerOpen)}
        onChange={(e) => {
          const masked = maskDateTimeDigits(e.target.value);
          setText(masked);
          if (!masked || /^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/.test(masked)) commit(masked);
        }}
        onBlur={() => {
          if (text && !displayToLocal(text)) setText(localToDisplay(value));
          if (!text) commit("");
        }}
      />
      <PickerButton open={open} setOpen={setPickerOpen} panelRef={panelRef} coords={coords}>
        {step === "date" ? (
          // `data-keep-open` so clicking a day advances to the time step instead of dismissing the
          // popover the way DateInput's single-step calendar does (see PopoverPanel).
          <div data-keep-open>
            <CalendarPanel
              selected={value.slice(0, 10)}
              onSelect={(day) => {
                const time = value.slice(11) || DEFAULT_PICKED_TIME;
                const local = `${day}T${time}`;
                setText(localToDisplay(local));
                onChange(local);
                setPickedDay(day);
                setStep("time");
              }}
            />
          </div>
        ) : (
          <TimePanel
            dayLabel={dayLabel.format(new Date(`${pickedDay}T00:00:00`))}
            selected={value.slice(0, 10) === pickedDay ? value.slice(11) : ""}
            onBack={() => setStep("date")}
            onSelect={(time) => {
              const local = `${pickedDay}T${time}`;
              setText(localToDisplay(local));
              onChange(local);
            }}
          />
        )}
      </PickerButton>
    </div>
  );
}
