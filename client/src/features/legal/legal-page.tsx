import type { ReactNode } from "react";
import { Link } from "react-router";
import { Card, Wordmark } from "../../shared/ui";

/** Shared shell for /privacy and /terms — public, no session/Shell chrome (see App.tsx). Both
 * documents are still internal drafts (see PRIVACY.md/TERMS.md at the repo root, the source of
 * this content) — the banner below is not decorative, it's the only thing telling a real visitor
 * that unfilled `[PLACEHOLDER]`s below aren't a rendering bug. Deliberately English-only (unlike
 * most app content, which ships an en+uk pair): duplicating an unreviewed legal draft into a
 * second language multiplies legal risk rather than translating it away. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-2 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex justify-center">
          <Link to="/">
            <Wordmark size="sm" />
          </Link>
        </div>
        <Card className="p-6 sm:p-8">
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <strong>Draft — not yet reviewed by a lawyer.</strong> This page is a good-faith, standard-practice starting point, not final
            legal advice. Bracketed text like <code className="rounded bg-black/5 px-1 dark:bg-white/10">[LIKE THIS]</code> marks a
            placeholder still pending a real value.
          </div>
          <h1 className="text-xl font-bold text-ink mb-4">{title}</h1>
          <div className="space-y-4 text-sm leading-relaxed text-ink [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mt-6 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-ink-dim [&_a]:hover:text-signal [&_a]:hover:underline [&_strong]:text-ink [&_p]:text-ink-dim [&_li]:text-ink-dim">
            {children}
          </div>
          <div className="mt-8 pt-4 border-t border-grid text-sm">
            <Link to="/" className="text-ink-dim hover:text-signal hover:underline">
              ← Back to Zorya
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
