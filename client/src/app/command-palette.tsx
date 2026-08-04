import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export interface PaletteNavItem {
  path: string;
  icon: string;
  label: string;
}
export interface PaletteAction {
  id: string;
  icon: string;
  label: string;
  onRun: () => void;
}

/** A lightweight Cmd/Ctrl+K command palette for jumping straight to any page or running a quick
 * action — useful now that the app has ~15 sections tucked into the sidebar. Hand-rolled (no new
 * dependency) since all it needs is substring filtering over a small, static list. Controlled
 * (`open`/`setOpen` from the parent) so both the global hotkey and a sidebar button can trigger it. */
export function CommandPalette({
  items,
  actions = [],
  open,
  setOpen,
}: {
  items: PaletteNavItem[];
  actions?: PaletteAction[];
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const { t } = useTranslation(["chrome", "common"]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setOpen is stable (useState setter)
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    type Entry = { key: string; icon: string; label: string; run: () => void };
    const navEntries: Entry[] = items.map((it) => ({
      key: `nav-${it.path}`,
      icon: it.icon,
      label: it.label,
      run: () => navigate(it.path),
    }));
    const actionEntries: Entry[] = actions.map((a) => ({ key: `action-${a.id}`, icon: a.icon, label: a.label, run: a.onRun }));
    const all = [...navEntries, ...actionEntries];
    const query = q.trim().toLowerCase();
    if (!query) return all;
    return all.filter((e) => e.label.toLowerCase().includes(query));
  }, [items, actions, q, navigate]);

  const run = (i: number) => {
    const entry = results[i];
    if (!entry) return;
    setOpen(false);
    entry.run();
  };

  if (!open) return null;

  // Backdrop is purely a click-to-dismiss target and the panel's onClick purely stops that click
  // from bubbling to the backdrop — neither is itself interactive content (the actual
  // interactive elements are the input/buttons inside), and Escape (handled globally above)
  // already covers the keyboard-equivalent close action, so no separate key handler is needed.
  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/40 flex items-start justify-center pt-[12vh] px-4"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-grid overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              run(active);
            }
          }}
          placeholder={t("commandPalette.placeholder")}
          aria-label={t("commandPalette.ariaLabel")}
          className="w-full px-4 py-3.5 text-sm outline-none border-b border-surface-2"
        />
        <div className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-ink-dim">{t("commandPalette.noResults", { query: q })}</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.key}
              onClick={() => run(i)}
              onMouseEnter={() => setActive(i)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                i === active ? "bg-signal/10 text-signal" : "text-ink"
              }`}
            >
              <span className="text-base w-5 text-center">{r.icon}</span>
              {r.label}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-surface-2 text-[11px] text-ink-dim flex gap-3">
          <span>{t("commandPalette.navigateHint")}</span>
          <span>{t("commandPalette.selectHint")}</span>
          <span>{t("commandPalette.closeHint")}</span>
        </div>
      </div>
    </div>
  );
}
