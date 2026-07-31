import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCvPublic } from "../../shared/queries";
import { buildCvHtml } from "./builder/cv-doc-utils";

/**
 * A shareable, read-only public CV page (GET /api/cv/public/:slug, no session) — reuses
 * buildCvHtml (the same CV Builder rendering used for the live preview and PDF export) rather
 * than a bespoke renderer, so any template/theme change automatically applies here too. Just a
 * plain full-height iframe (auto-sized to its content) — no zoom/click-to-edit affordances,
 * those are CV Builder-only editor UX that doesn't belong on a public page.
 */
export function CvPublic() {
  const { slug = "" } = useParams();
  const { data, isLoading, isError } = useCvPublic(slug);
  const [frameHeight, setFrameHeight] = useState(800);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="flex-1">
        {isLoading && <div className="text-center text-ink-dim text-sm py-20">Loading…</div>}
        {isError && (
          <div className="max-w-md mx-auto text-center py-20 px-4">
            <div className="text-4xl mb-3">🔗</div>
            <div className="font-display font-semibold text-ink">This CV link doesn't exist or has been disabled</div>
            <p className="text-sm text-ink-dim mt-2">Double-check the link, or ask its owner for a fresh one.</p>
          </div>
        )}
        {data && (
          <iframe
            title="CV"
            srcDoc={buildCvHtml(data.doc)}
            onLoad={(e) => setFrameHeight(e.currentTarget.contentDocument?.documentElement.scrollHeight ?? 800)}
            style={{ width: "100%", height: frameHeight, border: 0 }}
            className="bg-white"
          />
        )}
      </div>
      {/* No subscription/plan system exists in this codebase yet (no Stripe/Paddle integration) —
          this badge always shows. Hiding it for "paid" accounts is a real follow-up once real
          billing exists, not something to fake with an invented isPaid flag today. */}
      <a
        href="https://devradar.app"
        target="_blank"
        rel="noreferrer"
        className="block text-center text-xs text-ink-dim py-3 border-t border-grid hover:text-signal transition-colors"
      >
        Built with DevRadar — track your own job search free
      </a>
    </div>
  );
}
