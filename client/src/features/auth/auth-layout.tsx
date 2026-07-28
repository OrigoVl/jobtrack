import type { ReactNode } from "react";

/** Shared centered-card shell for every auth page (login/register/forgot/reset) — no sidebar. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent">
            🚀 JobTrack
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-6">
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{message}</div>;
}

export const authInputClass =
  "w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";
