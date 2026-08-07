import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router";

export interface SectionTab {
  path: string;
  label: string;
}

/**
 * The tab strip shown above a group of related pages (Vacancies/Find/Analyze, Contacts/Companies,
 * the seven Growth pages, the three CV pages) — mounted as a pathless layout route in app/App.tsx,
 * so it wraps its children WITHOUT changing any of their URLs. Existing links, bookmarks and
 * e2e specs that `goto("/jobs")` keep working exactly as before; the page just now renders with
 * its siblings' tabs above it.
 *
 * Deliberately real `NavLink`s rather than `Segmented` (shared/ui.tsx): these are navigation, not
 * a local state toggle — middle-click/cmd-click to open a tab in a new window, right-click "copy
 * link", and browser back/forward all have to behave. `Segmented`'s buttons give none of that.
 *
 * Just as deliberately, it does NOT look like `Segmented` either. Almost every page in these
 * groups already carries a `Segmented` of its own a few pixels below (Vacancies' Table/Kanban,
 * Roadmap's List/Radar, CV Builder's Content/Appearance, Practice's four modes) — rendering this
 * strip as a second pill-in-a-track produced two identical-looking controls stacked on top of
 * each other, the classic "tabs inside tabs" read where nothing signals which one moves you
 * between PAGES and which one just switches a view of the page you're on. An underlined tab bar
 * is the long-standing convention for the navigation level, so the hierarchy is legible at a
 * glance: underline = where am I, pill = how am I looking at it.
 *
 * Each child page keeps rendering its OWN `PageHeader` below this strip — no `embedded` prop
 * threading through a dozen feature files, and no page loses the controls it hangs off that
 * header's `actions` slot (the vacancy table/board switch, Companies' add-company input, the
 * Practice mode switcher…).
 */
// Shown once, ever, the first time anyone lands on a grouped section. `localStorage` rather than
// `useUi` (shared/ui-state.ts) on purpose: useUi's store is in-memory and resets on every reload,
// so a "you've seen this" flag kept there would re-nag forever. Matches the `jobtrack.*` key
// convention in shared/theme.ts / shared/notifications.ts.
const HINT_KEY = "jobtrack.sectionTabsHintSeen";

/** A single, dismissible line pointing at ⌘K. It exists because collapsing seventeen sidebar rows
 * into eight made the command palette the ONLY one-step route to a screen that's now a tab — and
 * nothing in the running app ever mentioned it except a small label in the sidebar's search box.
 * Deliberately anchored here, on the first grouped section the user opens, rather than as a
 * dashboard banner: this is the exact moment the concept "there are more screens than menu rows"
 * becomes visible, so it's when the tip actually means something. */
function ShortcutHint() {
  const { t } = useTranslation("chrome");
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === "1";
    } catch {
      // Private-mode/blocked storage — better to skip the tip entirely than to crash the shell.
      return true;
    }
  });
  if (dismissed) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore — the tip just reappears next session, which is harmless */
    }
    setDismissed(true);
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-grid bg-surface-2 px-3 py-1.5 text-xs text-ink-dim">
      <span>
        {t("sectionHint.text")} <kbd className="font-mono text-ink bg-surface border border-grid rounded px-1.5 py-0.5">⌘K</kbd>
      </span>
      <button onClick={dismiss} className="ml-auto shrink-0 font-medium hover:text-ink" aria-label={t("sectionHint.dismiss")}>
        {t("sectionHint.dismiss")}
      </button>
    </div>
  );
}

export function SectionTabs({ tabs, ariaLabel }: { tabs: SectionTab[]; ariaLabel: string }) {
  return (
    <div className="space-y-4">
      {/* The border sits on the nav itself so the rule runs the full content width, with each
          active tab's own -mb-px border-bottom punching through it. */}
      <nav aria-label={ariaLabel} className="border-b border-grid overflow-x-auto no-scrollbar">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-2 -mb-px border-b-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 rounded-t ${
                  isActive ? "border-star text-ink" : "border-transparent text-ink-dim hover:text-ink hover:border-grid"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <ShortcutHint />
      <Outlet />
    </div>
  );
}
