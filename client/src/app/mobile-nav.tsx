import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { MoreIcon, type IconComponent } from "../shared/icons";

export interface MobileNavItem {
  path: string;
  icon: IconComponent;
  label: string;
  active: boolean;
}

/**
 * The mobile navigation: four fixed primary destinations plus a "More" sheet holding the rest.
 *
 * It replaces a single horizontally-scrolling strip of every nav entry the app had — eighteen
 * chips in a row, with the section grouping (the only thing that made that many entries
 * scannable on desktop) dropped entirely on the way down to mobile, and the last few entries
 * permanently off-screen unless you thought to swipe a nav bar sideways. A bottom bar is where
 * phone users' thumbs already are and where every other app on their phone puts this.
 *
 * The sheet closes on navigation (see the effect below) and on Escape, and the bar itself sits at
 * z-30: above page content, but deliberately below the confirm dialog (z-70), popovers (z-75) and
 * toasts (z-80), so it never floats over a modal that's asking the user something.
 */
export function MobileNav({ primary, more, onLogOut }: { primary: MobileNavItem[]; more: MobileNavItem[]; onLogOut: () => void }) {
  const { t } = useTranslation("nav");
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();

  // Any navigation dismisses the sheet — including a tap on an entry that's already active,
  // which produces no pathname change, hence the explicit onClick on each link below too.
  useEffect(() => {
    setSheetOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen]);

  const moreActive = more.some((it) => it.active);

  return (
    <>
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end" role="presentation">
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Escape (handled above) is the keyboard equivalent; the interactive content is the links inside. */}
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSheetOpen(false)} />
          <div
            className="relative bg-surface border-t border-grid rounded-t-2xl p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl animate-[jt-fade-in_0.15s_ease-out]"
            aria-label={t("mobile.moreAriaLabel")}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-grid" aria-hidden />
            <nav className="grid grid-cols-3 gap-2">
              {more.map((it) => (
                <NavLink
                  key={it.path}
                  to={it.path}
                  onClick={() => setSheetOpen(false)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
                    it.active ? "border-signal/40 bg-signal/10 text-signal" : "border-grid text-ink-dim hover:text-ink"
                  }`}
                >
                  <it.icon className="w-5 h-5" />
                  <span className="text-center leading-tight">{it.label}</span>
                </NavLink>
              ))}
            </nav>
            <button
              onClick={() => {
                setSheetOpen(false);
                onLogOut();
              }}
              className="mt-3 w-full rounded-xl border border-grid px-3 py-2.5 text-sm font-medium text-ink-dim hover:text-ink transition-colors"
            >
              {t("logOut")}
            </button>
            <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-ink-dim">
              <NavLink to="/privacy" onClick={() => setSheetOpen(false)} className="hover:text-ink hover:underline">
                {t("footer.privacy")}
              </NavLink>
              <span aria-hidden="true">·</span>
              <NavLink to="/terms" onClick={() => setSheetOpen(false)} className="hover:text-ink hover:underline">
                {t("footer.terms")}
              </NavLink>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label={t("mobile.primaryAriaLabel")}
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-grid bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        {primary.map((it) => (
          <NavLink
            key={it.path}
            to={it.path}
            aria-current={it.active ? "page" : undefined}
            // min-h-[3.25rem] keeps every target comfortably past the ~44px minimum touch size
            // even with the label under the icon.
            className={`flex-1 min-h-[3.25rem] flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${
              it.active ? "text-signal" : "text-ink-dim"
            }`}
          >
            <it.icon className="w-5 h-5" />
            <span className="leading-none">{it.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setSheetOpen((v) => !v)}
          aria-expanded={sheetOpen}
          aria-label={t("mobile.moreAriaLabel")}
          className={`flex-1 min-h-[3.25rem] flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${
            sheetOpen || moreActive ? "text-signal" : "text-ink-dim"
          }`}
        >
          <MoreIcon className="w-5 h-5" />
          <span className="leading-none">{t("mobile.more")}</span>
        </button>
      </nav>
    </>
  );
}
