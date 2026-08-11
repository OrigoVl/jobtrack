import { useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useCvPublic } from "../../shared/queries";
import { applyCvCss, buildCvDocument } from "./builder/cv-doc-utils";

/**
 * A shareable, read-only public CV page (GET /api/cv/public/:slug, no session) — reuses
 * buildCvDocument (the same CV Builder rendering used for the live preview and PDF export) rather
 * than a bespoke renderer, so any template/theme change automatically applies here too. Just a
 * plain full-height iframe (auto-sized to its content) — no zoom/click-to-edit affordances,
 * those are CV Builder-only editor UX that doesn't belong on a public page.
 */
export function CvPublic() {
  const { t } = useTranslation(["cv", "common"]);
  const { slug = "" } = useParams();
  const { data, isLoading, isError } = useCvPublic(slug);
  const [frameHeight, setFrameHeight] = useState(800);
  const cv = data ? buildCvDocument(data.doc) : null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="flex-1">
        {isLoading && <div className="text-center text-ink-dim text-sm py-20">{t("common:state.loading")}</div>}
        {isError && (
          <div className="max-w-md mx-auto text-center py-20 px-4">
            <div className="font-display font-semibold text-ink">{t("publicShare.notFoundTitle")}</div>
            <p className="text-sm text-ink-dim mt-2">{t("publicShare.notFoundHint")}</p>
          </div>
        )}
        {cv && (
          <iframe
            title={t("publicShare.iframeTitle")}
            srcDoc={cv.html}
            // Styles go in here, not as a <style> inside srcDoc: this iframe inherits the app's
            // CSP, which blocks inline <style> elements (see applyCvCss). Applied before reading
            // scrollHeight, since an unstyled document measures a different height.
            onLoad={(e) => {
              const frameDoc = e.currentTarget.contentDocument;
              if (frameDoc) applyCvCss(frameDoc, cv.css);
              setFrameHeight(frameDoc?.documentElement.scrollHeight ?? 800);
            }}
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
        {t("publicShare.footer")}
      </a>
    </div>
  );
}
