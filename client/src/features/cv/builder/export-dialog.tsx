import { useTranslation } from "react-i18next";
import { Btn, Chip } from "../../../shared/ui";
import type { AuditFinding } from "./cv-audit";

/**
 * Confirmation step between "Export PDF" and the print dialog.
 *
 * Export is the moment the document stops being a draft and becomes the file a recruiter opens, so
 * it's the last useful place to say "these two things are still wrong" — a high-severity finding
 * caught here costs one click, and caught after sending costs the application. It also carries the
 * one instruction the app genuinely cannot enforce for the user: Chrome's print dialog drops
 * background graphics by DEFAULT, which silently strips the bullet dots, chip tints and rules from
 * the exported file while the on-screen preview keeps showing them.
 */
export function ExportDialog({
  pages,
  findings,
  onExport,
  onClose,
  onReview,
}: {
  pages: number;
  /** Only the high-severity ones are worth stopping for — this is a last check, not the audit. */
  findings: AuditFinding[];
  onExport: () => void;
  onClose: () => void;
  onReview: () => void;
}) {
  const { t } = useTranslation(["cv", "common"]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-3 md:p-6">
      <button type="button" aria-label={t("common:actions.close")} onClick={onClose} className="fixed inset-0 bg-ink/60 cursor-default" />
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-2 flex items-center justify-between">
          <span className="font-semibold text-ink">{t("exportDialog.title")}</span>
          <button
            onClick={onClose}
            aria-label={t("common:actions.close")}
            className="text-ink-dim hover:text-ink text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Chip tone={pages > 2 ? "amber" : "slate"}>{t("exportDialog.pages", { count: pages })}</Chip>
            {pages > 2 && <span className="text-xs text-ink-dim">{t("exportDialog.pagesHint")}</span>}
          </div>

          {findings.length > 0 && (
            <div className="rounded-lg border border-alert/30 bg-alert/10 px-3 py-2 space-y-1.5">
              <div className="text-sm font-semibold text-ink">{t("exportDialog.outstanding", { count: findings.length })}</div>
              <ul className="list-disc pl-4 text-xs text-ink-dim space-y-0.5">
                {findings.slice(0, 4).map((f) => (
                  <li key={f.id}>{f.rule ? t(`audit.rules.${f.rule}.title` as "audit.rules.missingLocation.title") : f.title}</li>
                ))}
              </ul>
              <Btn size="sm" variant="ghost" onClick={onReview}>
                {t("exportDialog.reviewThem")}
              </Btn>
            </div>
          )}

          {/* Not a nag — this genuinely changes what lands in the file, and it's a checkbox only
              the user can reach. */}
          <p className="text-xs text-ink-dim">{t("exportDialog.backgroundsHint")}</p>

          <div className="flex gap-2 justify-end pt-1">
            <Btn variant="ghost" onClick={onClose}>
              {t("common:actions.cancel")}
            </Btn>
            <Btn onClick={onExport}>{t("exportDialog.exportNow")}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
