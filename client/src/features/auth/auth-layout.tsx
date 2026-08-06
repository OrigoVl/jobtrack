import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Wordmark } from "../../shared/ui";

/** Shared centered-card shell for every auth page (login/register/forgot/reset) — no sidebar.
 * Follows the app's own light/dark toggle like every other page now — the previous palette's
 * fixed dark "night sky" world doesn't exist in this landing page's design at all (it has no dark
 * mode, no hero-specific treatment to mirror here). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  const { t } = useTranslation("auth");
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Wordmark size="lg" />
        </div>
        <div className="rounded-xl bg-surface border border-grid p-6">
          <h1 className="text-lg font-bold text-ink">{title}</h1>
          {subtitle && <p className="text-sm text-ink-dim mt-1">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-ink-dim">
          <Link to="/privacy" className="hover:text-ink hover:underline">
            {t("footer.privacy")}
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className="hover:text-ink hover:underline">
            {t("footer.terms")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 dark:text-rose-300 dark:bg-rose-950 dark:border-rose-800">
      {message}
    </div>
  );
}

export const authInputClass =
  "w-full bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50";
