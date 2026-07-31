import { useEffect, useState } from "react";

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

/**
 * A locale-independent replacement for `<input type="date">`. Native date inputs render in the
 * OS/browser locale regardless of the page's language (a Ukrainian-locale OS shows dd.mm.yyyy
 * even inside this English-only UI, and `lang` on the element isn't reliably honored across
 * browsers) — this always displays and accepts "mm/dd/yyyy", matching the rest of the English UI,
 * and stores/emits the value as ISO "yyyy-mm-dd" (what the API and analytics expect).
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
  const [text, setText] = useState(() => isoToDisplay(value));

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
    <input
      type="text"
      inputMode="numeric"
      placeholder="mm/dd/yyyy"
      value={text}
      aria-label={ariaLabel}
      className={className}
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
  );
}
