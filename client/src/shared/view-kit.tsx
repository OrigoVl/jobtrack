import { useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";

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
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-0.5 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
}: {
  label: string;
  skills: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

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
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-indigo-400">
        {skills.map((s, i) => (
          <span
            key={`${s}-${i}`}
            className="inline-flex items-center gap-1 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
          >
            {s}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${s}`}
              className="text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 rounded-full w-4 h-4 inline-flex items-center justify-center leading-none"
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
          onBlur={onBlur}
          placeholder={skills.length ? "add another…" : placeholder}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none py-0.5"
        />
      </div>
    </label>
  );
}
