import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Btn, Card, Chip } from "../../../shared/ui";
import type { AuditFinding, AuditJumpTarget, AuditRule, AuditSeverity } from "./cv-audit";
import { isMechanical, jumpTargetFor } from "./cv-audit";
import { CvAuditProgress } from "./cv-audit-progress";
import type { CvAuditStep } from "../../../shared/types";

const SEVERITY_TONE: Record<AuditSeverity, "rose" | "amber" | "slate"> = {
  high: "rose",
  medium: "amber",
  low: "slate",
};

/** Rule ids are resolved to copy here rather than in the engine, so cv-audit.ts stays free of
 * strings and the two locales can't drift away from the logic. */
function ruleCopy(rule: AuditRule, t: TFunction<["cv", "common"]>): { title: string; reason: string } {
  return {
    title: t(`audit.rules.${rule}.title` as "audit.rules.missingLocation.title"),
    reason: t(`audit.rules.${rule}.reason` as "audit.rules.missingLocation.reason"),
  };
}

/** A finding's headline, whichever producer it came from. */
function findingTitle(f: AuditFinding, t: TFunction<["cv", "common"]>): string {
  return f.rule ? ruleCopy(f.rule, t).title : (f.title ?? "");
}

/**
 * What "apply all" is about to do, itemised, before it does it.
 *
 * A bulk button labelled only with a COUNT is the problem this solves: six of nine findings were
 * going to change the document and there was no way to tell which six, so the honest response was
 * not to press it. Listing each one — with the actual before→after, not just its title — turns the
 * button into a reviewable step. The panel also serves as the answer to "which rows are included",
 * since the mechanical ones are marked in the list below too.
 */
function BulkPreview({ findings, onConfirm, onCancel }: { findings: AuditFinding[]; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation(["cv", "common"]);
  return (
    <div className="rounded-xl border border-signal/30 bg-signal/10 p-3 space-y-2">
      <div className="text-sm font-semibold text-ink">{t("audit.bulk.previewTitle", { count: findings.length })}</div>
      <ul className="space-y-1.5">
        {findings.map((f) => (
          <li key={f.id} className="text-xs">
            <div className="font-medium text-ink">{findingTitle(f, t)}</div>
            {(f.before || f.after) && (
              <div className="text-ink-dim mt-0.5 flex flex-wrap items-center gap-1.5">
                {f.before && <span className="line-through decoration-rose-400/60">{f.before}</span>}
                {f.before && f.after && <span aria-hidden>→</span>}
                {f.after && <span className="text-good font-medium">{f.after}</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2 pt-0.5">
        <Btn size="sm" onClick={onConfirm}>
          {t("audit.bulk.confirm", { count: findings.length })}
        </Btn>
        <Btn size="sm" variant="ghost" onClick={onCancel}>
          {t("common:actions.cancel")}
        </Btn>
      </div>
    </div>
  );
}

/** One finding: what it's about, why, and the before→after when there's something to apply. */
function FindingCard({
  finding,
  onApply,
  onDismiss,
  onJump,
  applying,
}: {
  finding: AuditFinding;
  onApply: (f: AuditFinding) => void;
  onDismiss: (f: AuditFinding) => void;
  onJump: (target: AuditJumpTarget) => void;
  applying: boolean;
}) {
  const { t } = useTranslation(["cv", "common"]);
  const copy = finding.rule ? ruleCopy(finding.rule, t) : { title: finding.title ?? "", reason: finding.reason ?? "" };
  // A finding without a replacement is diagnostic — it names a problem the candidate has to think
  // about (a cliché opener, a job with no numbers in it). Offering an "Apply" that did nothing
  // would be worse than offering none, so those get a jump-to-the-field button instead.
  const canApply = finding.after !== undefined || finding.verdict === "delete";
  return (
    <div className="rounded-xl border border-grid bg-surface p-3 space-y-2">
      <div className="flex items-start gap-2 flex-wrap">
        <Chip tone={SEVERITY_TONE[finding.severity]}>{t(`audit.verdict.${finding.verdict}` as "audit.verdict.rewrite")}</Chip>
        <span className="font-semibold text-ink text-sm flex-1 min-w-0">{copy.title}</span>
        {/* Marks the rows the bulk action covers, so its count maps to something visible rather
            than being a number the user has to take on trust. */}
        {isMechanical(finding) && <Chip tone="good">{t("audit.bulk.badge")}</Chip>}
        {finding.source === "ai" && <Chip tone="indigo">{t("audit.aiBadge")}</Chip>}
      </div>
      {copy.reason && <p className="text-xs text-ink-dim">{copy.reason}</p>}
      {(finding.before || finding.after) && (
        <div className="space-y-1 text-xs">
          {finding.before && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 text-ink-dim line-through decoration-rose-400/60">
              {finding.before}
            </div>
          )}
          {finding.after && <div className="rounded-lg bg-good/10 px-2.5 py-1.5 text-ink">{finding.after}</div>}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {canApply ? (
          <Btn size="sm" onClick={() => onApply(finding)} loading={applying}>
            {t(finding.verdict === "delete" ? "audit.actions.remove" : "audit.actions.apply")}
          </Btn>
        ) : (
          <Btn size="sm" variant="ghost" onClick={() => onJump(jumpTargetFor(finding.target))}>
            {t("audit.actions.goFix")}
          </Btn>
        )}
        <Btn size="sm" variant="ghost" onClick={() => onDismiss(finding)}>
          {t("audit.actions.dismiss")}
        </Btn>
      </div>
    </div>
  );
}

/**
 * The CV Builder's "Audit" editor mode: every finding about the document, grouped by severity,
 * each with a one-click fix.
 *
 * The shape deliberately mirrors how a written résumé audit reads — a verdict per line with a
 * ready replacement — rather than the score-plus-prose of the existing AI review, because that's
 * the form the advice can actually be ACTED on in. Two producers feed one list: the deterministic
 * rules (instant, offline, provable) and the AI layer (positioning and judgement), distinguished
 * by a badge so the user can tell "this is a fact about your CV" from "this is an opinion".
 */
export function AuditPanel({
  findings,
  positioning,
  score,
  summary,
  strengths,
  keywords,
  onAddKeyword,
  running,
  step,
  offline,
  hasRun,
  onRun,
  onApply,
  onApplyAll,
  onDismiss,
  onJump,
  applyingId,
}: {
  findings: AuditFinding[];
  positioning: { detectedRole: string; suggestedTitle: string; rationale: string } | null;
  /** Whole-document judgements, folded in from what used to be a separate review call. */
  score: number | null;
  summary: string;
  strengths: string[];
  keywords: string[];
  onAddKeyword: (k: string) => void;
  running: boolean;
  /** Coarse phase of the background job, for the progress display while it runs. */
  step: CvAuditStep | null;
  offline: boolean;
  hasRun: boolean;
  onRun: () => void;
  onApply: (f: AuditFinding) => void;
  onApplyAll: (fs: AuditFinding[]) => void;
  onDismiss: (f: AuditFinding) => void;
  onJump: (target: AuditJumpTarget) => void;
  applyingId: string | null;
}) {
  const { t } = useTranslation(["cv", "common"]);
  const [bulkPreview, setBulkPreview] = useState(false);
  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");
  const low = findings.filter((f) => f.severity === "low");
  // Only the mechanical ones are offered in bulk — a prose rewrite is a judgement the candidate
  // should read before accepting, and "apply 20 AI rewrites at once" is how a CV stops sounding
  // like the person who wrote it.
  const bulk = findings.filter(isMechanical);

  const groups: [string, AuditFinding[]][] = [
    [t("audit.groups.high"), high],
    [t("audit.groups.medium"), medium],
    [t("audit.groups.low"), low],
  ];

  return (
    <div className="space-y-3">
      <Card className="!py-3.5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="font-semibold text-ink">{t("audit.title")}</div>
            <p className="text-xs text-ink-dim mt-0.5">{t("audit.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Opens the itemised preview rather than applying — see BulkPreview. */}
            {bulk.length > 0 && (
              <Btn size="sm" variant="ghost" onClick={() => setBulkPreview((v) => !v)} title={t("audit.applyAllTitle")}>
                {t("audit.applyAll", { count: bulk.length })}
              </Btn>
            )}
            <Btn size="sm" onClick={onRun} loading={running}>
              {t(hasRun ? "audit.rerun" : "audit.run")}
            </Btn>
          </div>
        </div>
        {/* The count is the headline: "11 things to fix" is the number the user came for. */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {findings.length === 0 ? (
            <span className="text-good font-medium">{t("audit.allClear")}</span>
          ) : (
            <>
              {high.length > 0 && <Chip tone="rose">{t("audit.counts.high", { count: high.length })}</Chip>}
              {medium.length > 0 && <Chip tone="amber">{t("audit.counts.medium", { count: medium.length })}</Chip>}
              {low.length > 0 && <Chip tone="slate">{t("audit.counts.low", { count: low.length })}</Chip>}
            </>
          )}
          {offline && <Chip>{t("audit.offlineBadge")}</Chip>}
        </div>
        {/* Says plainly that the instant half already ran, so an empty-looking panel with no key
            doesn't read as a broken feature. */}
        {offline && <p className="text-[11px] text-ink-dim">{t("audit.offlineHint")}</p>}
        {/* The whole-document verdict. Folded in from what used to be a separate review card above
            the editor, which cost a second LLM call over the same résumé and could contradict the
            findings below it on the same line. */}
        {score != null && (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">{t("audit.scoreLabel")}</span>
              <span className="ml-auto text-2xl font-extrabold text-ink">
                {score}
                <span className="text-xs text-ink-dim">{t("reports.per100")}</span>
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${score >= 75 ? "bg-good" : score >= 50 ? "bg-star" : "bg-rose-500"}`}
                style={{ width: `${score}%` }}
              />
            </div>
            {summary && <p className="text-sm text-ink-dim">{summary}</p>}
          </div>
        )}
        {strengths.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-ink mb-1">{t("audit.strengthsTitle")}</div>
            <ul className="list-disc pl-5 text-sm text-ink space-y-0.5">
              {strengths.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        )}
        {keywords.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-ink-dim mb-1">
              {t("audit.keywordsTitle")}
              {t("audit.keywordsHint")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => onAddKeyword(k)}
                  className="rounded-full bg-surface-2 text-ink-dim border border-grid px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-signal/40 hover:bg-signal/10 hover:text-signal"
                >
                  + {k}
                </button>
              ))}
            </div>
          </div>
        )}
        {bulkPreview && bulk.length > 0 && (
          <BulkPreview
            findings={bulk}
            onCancel={() => setBulkPreview(false)}
            onConfirm={() => {
              setBulkPreview(false);
              onApplyAll(bulk);
            }}
          />
        )}
      </Card>

      {positioning && (
        <Card className="!py-3.5 bg-signal/10 border-signal/30 space-y-1.5">
          <div className="font-semibold text-ink text-sm">{t("audit.positioning.title")}</div>
          <p className="text-sm text-ink">
            {t("audit.positioning.readsAs")} <b>{positioning.detectedRole}</b>
            {positioning.suggestedTitle && (
              <>
                {" · "}
                {t("audit.positioning.shouldBe")} <b>{positioning.suggestedTitle}</b>
              </>
            )}
          </p>
          {positioning.rationale && <p className="text-xs text-ink-dim">{positioning.rationale}</p>}
        </Card>
      )}

      {running && (
        <Card className="!py-3.5">
          <div className="text-sm font-semibold text-ink mb-1">{t("audit.runningHint")}</div>
          <div className="text-xs text-ink-dim mb-3">{t("audit.runningBackgroundHint")}</div>
          <CvAuditProgress step={step} />
        </Card>
      )}

      {groups.map(([label, items]) =>
        items.length === 0 ? null : (
          <div key={label} className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-dim px-1">
              {label} · {items.length}
            </div>
            {items.map((f) => (
              <FindingCard key={f.id} finding={f} onApply={onApply} onDismiss={onDismiss} onJump={onJump} applying={applyingId === f.id} />
            ))}
          </div>
        ),
      )}
    </div>
  );
}
