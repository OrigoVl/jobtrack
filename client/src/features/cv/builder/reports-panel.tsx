import { useTranslation } from "react-i18next";
import { Btn, Card, Chip, Segmented } from "../../../shared/ui";
import { useToast } from "../../../shared/use-toast";
import type { CvMatch, CvTailorResult } from "../../../shared/types";
import { CvMatchPanel } from "../cv";
import { exportCvDoc } from "./cv-doc-utils";

type ReportKind = "match" | "tailor";

/**
 * The single reports card rendered under the CV Builder toolbar — either "Compare"
 * (CvMatchPanel) or "Tailor" results, switchable via a tab strip when both are available. Kept as
 * one fixed-position card (not independently-ordered blocks) so running one report after another
 * never pushes an earlier result out of view — it's one click away, not gone.
 *
 * Whole-document feedback deliberately does NOT live here: that's the Audit editor mode, which
 * addresses findings to specific lines and can apply them. These two reports are per-VACANCY,
 * which is a different question from "is my CV good".
 */
export function ReportsPanel({
  match,
  tailored,
  activeReport,
  setActiveReport,
  setMatch,
  setTailored,
  tailorVacancyLabel,
  onAddKeyword,
  onApplyTailored,
  onApplySummary,
}: {
  match: CvMatch | null;
  tailored: CvTailorResult | null;
  activeReport: ReportKind;
  setActiveReport: (v: ReportKind) => void;
  setMatch: (v: CvMatch | null) => void;
  setTailored: (v: CvTailorResult | null) => void;
  /** Label of the vacancy the current `tailored` result was generated for, if any. */
  tailorVacancyLabel: string | undefined;
  onAddKeyword: (k: string) => void;
  onApplyTailored: () => void;
  onApplySummary: (s: string) => void;
}) {
  const { t } = useTranslation(["cv", "common"]);
  const { toast } = useToast();
  if (!match && !tailored) return null;
  // Which reports actually exist — falls back to whichever is available if the remembered tab
  // was hidden/cleared, so the dismiss (✕) button always acts on what's actually on screen.
  const available: ReportKind[] = [...(match ? (["match"] as const) : []), ...(tailored ? (["tailor"] as const) : [])];
  const current = available.includes(activeReport) ? activeReport : available[0];
  const hide = () => (current === "match" ? setMatch(null) : setTailored(null));
  const tailorChanged = !!tailored && (tailored.reordered.skills > 0 || tailored.reordered.bullets > 0 || !!tailored.match.tailoredSummary);
  return (
    <div className="space-y-2">
      {available.length > 1 && (
        <Segmented
          value={current}
          onChange={setActiveReport}
          options={(
            [
              { value: "match", label: t("builder.reports.tabs.match") },
              { value: "tailor", label: t("builder.reports.tabs.tailor") },
            ] as const
          ).filter((o) => available.includes(o.value))}
        />
      )}
      <div className="relative">
        <button
          onClick={hide}
          title={t("builder.reports.hide")}
          aria-label={t("builder.reports.hide")}
          className="absolute right-3 top-3 z-10 text-ink-dim hover:text-ink-dim text-sm"
        >
          ✕
        </button>
        {current === "tailor" && tailored ? (
          <div className="space-y-2">
            <Card className="!py-3.5 bg-signal/10 border-signal/30 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap pr-6">
                <span className="font-semibold text-ink">
                  {tailorVacancyLabel
                    ? t("builder.reports.tailor.titleFor", { vacancy: tailorVacancyLabel })
                    : t("builder.reports.tailor.title")}
                </span>
                {tailored.match.offline && <Chip>{t("shared.offline")}</Chip>}
              </div>
              <p className="text-sm text-ink">
                {tailorChanged
                  ? t(tailored.match.tailoredSummary ? "builder.reports.tailor.reorderedWithSummary" : "builder.reports.tailor.reordered", {
                      skills: t("builder.reports.tailor.reorderedSkills", { count: tailored.reordered.skills }),
                      bullets: t("builder.reports.tailor.reorderedBullets", { count: tailored.reordered.bullets }),
                    })
                  : t("builder.reports.tailor.noChangeNeeded")}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Btn size="sm" onClick={onApplyTailored}>
                  {t("builder.reports.tailor.applyToCv")}
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => exportCvDoc(tailored.doc, () => toast(t("builder.header.exportPopupBlocked"), "error"))}
                >
                  {t("builder.reports.tailor.exportTailoredPdf")}
                </Btn>
              </div>
            </Card>
            <CvMatchPanel match={tailored.match} onAddKeyword={onAddKeyword} />
          </div>
        ) : (
          match && <CvMatchPanel match={match} onAddKeyword={onAddKeyword} onApplySummary={onApplySummary} />
        )}
      </div>
    </div>
  );
}
