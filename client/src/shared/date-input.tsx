import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPanel } from "./calendar-panel";
import { usePopover, type PopoverCoords } from "./use-popover";
import { PopoverPanel } from "./popover";

// Matches CalendarPanel's own `w-64` / rough rendered height — used only to keep the popover
// inside the viewport (see useCalendarPopover below), not for layout.
const PANEL_WIDTH = 256;
const PANEL_HEIGHT_ESTIMATE = 280;

/** Formats an ISO "yyyy-mm-dd" date as "mm/dd/yyyy" for display. Empty/invalid input → "". */
function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${mo}/${d}/${y}`;
}

/** Parses a "mm/dd/yyyy" display string into an ISO "yyyy-mm-dd" date, or null if incomplete/invalid
 * (including out-of-range months/days — a masked text input can't stop someone from typing "13/40/2026"). */
function displayToIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const [, mo, d, y] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** Re-applies "mm/dd/yyyy" slashes as the user types/deletes digits, capping at 8 digits total. */
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
  return usePopover((rect) => {
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8);
    const fitsBelow = rect.bottom + PANEL_HEIGHT_ESTIMATE + 4 <= window.innerHeight;
    const top = fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - PANEL_HEIGHT_ESTIMATE - 4);
    return { top, left };
  });
}

/** The small 📅 toggle button glued to the right edge of the input, plus the popover panel (see
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
  panelRef: RefObject<HTMLDivElement>;
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
        📅
      </button>
      <PopoverPanel open={open} panelRef={panelRef} coords={coords} onClose={() => setOpen(false)}>
        {children}
      </PopoverPanel>
    </>
  );
}

/**
 * A locale-independent replacement for `<input type="date">`. Native date inputs render in the
 * OS/browser locale regardless of the page's language (a Ukrainian-locale OS shows dd.mm.yyyy
 * even inside this English-only UI, and `lang` on the element isn't reliably honored across
 * browsers) — this always displays and accepts "mm/dd/yyyy", matching the rest of the English UI,
 * and stores/emits the value as ISO "yyyy-mm-dd" (what the API and analytics expect). A calendar
 * icon opens a month-grid popover (CalendarPanel) for picking a day visually, on top of typing.
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
        // The mm/dd/yyyy digit ORDER is deliberately locale-invariant (see the file doc-comment
        // below) — the placeholder text is wired through i18n so it CAN differ, but both locales
        // currently keep it identical on purpose: showing a different order here without also
        // changing what maskDigits/displayToIso actually accept would mislead, not help.
        placeholder={t("dateInput.datePlaceholder")}
        value={text}
        aria-label={ariaLabel}
        className={`${className ?? ""} pr-7`}
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
 * "mm/dd/yyyy, HH:mm" for display. Empty/invalid input → "". */
function localToDisplay(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return "";
  const [, y, mo, d, h, mi] = m;
  return `${mo}/${d}/${y}, ${h}:${mi}`;
}

/** Parses a "mm/dd/yyyy, HH:mm" display string into a local "yyyy-MM-ddTHH:mm" string, or null if
 * incomplete/invalid. */
function displayToLocal(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})$/.exec(display);
  if (!m) return null;
  const [, mo, d, y, h, mi] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || Number(h) > 23 || Number(mi) > 59) return null;
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

/** Re-applies "mm/dd/yyyy, HH:mm" separators as the user types/deletes digits, capping at 12
 * digits total (MMDDYYYYHHmm). */
function maskDateTimeDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  const mo = digits.slice(0, 2);
  const d = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  const h = digits.slice(8, 10);
  const mi = digits.slice(10, 12);
  let out = mo;
  if (d) out += `/${d}`;
  if (y) out += `/${y}`;
  if (h) out += `, ${h}`;
  if (mi) out += `:${mi}`;
  return out;
}

/** Default time of day filled in when picking a day from the calendar popover on a field that
 * doesn't have one yet — mid-morning, a reasonable default for scheduling an interview/call. */
const DEFAULT_PICKED_TIME = "09:00";

/**
 * A locale-independent replacement for `<input type="datetime-local">`, for the same reason as
 * `DateInput` above (a Ukrainian-locale OS renders "дд.мм.рррр, --:--" instead of an English
 * placeholder, and `lang` on the element isn't reliably honored across browsers). Value/onChange
 * use the same local "yyyy-MM-ddTHH:mm" string a native `datetime-local` input's `value`/
 * `e.target.value` would — a drop-in replacement for call sites already using
 * `toLocalInput`/`fromLocalInput` (see `calendar-date-utils.ts`). A calendar icon opens the same
 * month-grid popover as DateInput for picking the day visually; the time-of-day is still typed.
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
  const { t } = useTranslation();
  const [text, setText] = useState(() => localToDisplay(value));
  const { open, setOpen, anchorRef, panelRef, coords } = useCalendarPopover();

  useEffect(() => {
    setText(localToDisplay(value));
  }, [value]);

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
      <PickerButton open={open} setOpen={setOpen} panelRef={panelRef} coords={coords}>
        <CalendarPanel
          selected={value.slice(0, 10)}
          onSelect={(day) => {
            const time = value.slice(11) || DEFAULT_PICKED_TIME;
            const local = `${day}T${time}`;
            setText(localToDisplay(local));
            onChange(local);
          }}
        />
      </PickerButton>
    </div>
  );
}
