import type { ReactNode } from "react";

/** Shared centered-card shell for every auth page (login/register/forgot/reset) — no sidebar. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-signal to-signal bg-clip-text text-transparent">
            📡 DevRadar
          </div>
        </div>
        <div className="rounded-2xl bg-surface border border-grid shadow-card p-6">
          <h1 className="text-lg font-bold text-ink">{title}</h1>
          {subtitle && <p className="text-sm text-ink-dim mt-1">{subtitle}</p>}
          <div className="mt-5">{children}</div>
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
