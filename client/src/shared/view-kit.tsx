import { useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { SKILL_SUGGESTIONS } from "./skill-suggestions";

// Small shared components used across several view files.

/** A simple labeled text input — used in CV (view) and the CV Builder. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-dim">{label}</span>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
      />
    </label>
  );
}

/**
 * Skills editor as removable chips + a single "add" input, instead of one long
 * comma-separated string field — removing/scanning one skill among many no longer means
 * carefully editing raw text without breaking the neighbors. Enter/comma commits the draft
 * as a chip, Backspace on an empty draft removes the last chip, and pasting a comma-separated
 * list (e.g. from an old export) still splits into multiple chips at once. Skills stay a plain
 * `string[]` — no schema/API change, this only replaces how it's edited.
 */
export function SkillsInput({
  label,
  skills,
  onChange,
  placeholder,
  hideLabel = false,
}: {
  label: string;
  skills: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
  /** Omit the label — used when the parent already shows a title (e.g. an accordion header). */
  hideLabel?: boolean;
}) {
  const { t } = useTranslation(["chrome", "common"]);
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const selectedLower = new Set(skills.map((s) => s.toLowerCase()));
  const q = draft.trim().toLowerCase();
  // Empty query → a handful of popular defaults; typing → filtered matches. Either way capped
  // at 8 so this never turns into a giant wall of chips (the point is quick-add, not a catalog).
  const suggestions = SKILL_SUGGESTIONS.filter((s) => !selectedLower.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q))).slice(
    0,
    8,
  );
  const addSuggestion = (s: string) => {
    if (!selectedLower.has(s.toLowerCase())) onChange([...skills, s]);
    setDraft("");
  };

  const commit = (raw: string) => {
    const seen = new Set(skills.map((s) => s.toLowerCase()));
    const fresh: string[] = [];
    for (const part of raw.split(",")) {
      const s = part.trim();
      if (!s || seen.has(s.toLowerCase())) continue;
      seen.add(s.toLowerCase());
      fresh.push(s);
    }
    if (fresh.length) onChange([...skills, ...fresh]);
  };

  const removeAt = (i: number) => onChange(skills.filter((_, idx) => idx !== i));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && skills.length > 0) {
      removeAt(skills.length - 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text.includes(",")) {
      e.preventDefault();
      commit(text);
      setDraft("");
    }
  };

  const onBlur = () => {
    if (!draft.trim()) return;
    commit(draft);
    setDraft("");
  };

  return (
    <label className="block">
      {!hideLabel && <span className="text-xs font-semibold text-ink-dim">{label}</span>}
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 bg-surface-2 border border-grid rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-signal/50">
        {skills.map((s, i) => (
          <span
            key={`${s}-${i}`}
            className="inline-flex items-center gap-1 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full bg-signal/10 text-signal border border-signal/30"
          >
            {s}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={t("skillsInput.removeSkill", { skill: s })}
              className="text-signal/60 hover:text-signal hover:bg-signal/10 rounded-full w-4 h-4 inline-flex items-center justify-center leading-none"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur();
          }}
          placeholder={skills.length ? t("skillsInput.searchPlaceholder") : (placeholder ?? t("skillsInput.searchPlaceholder"))}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none py-0.5"
        />
      </div>
      {focused && suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-dim">{t("skillsInput.suggestions")}</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              // Prevent the default focus-shift on mousedown so the input never blurs before
              // onClick fires — otherwise the suggestions list would disappear right as it's
              // clicked (blur happens before click in the event order).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addSuggestion(s)}
              className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-ink-dim border border-grid hover:bg-signal/10 hover:text-signal hover:border-signal/30"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
