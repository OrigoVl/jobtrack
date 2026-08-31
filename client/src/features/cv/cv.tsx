import { useState } from "react";
import { Link } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useToast } from "../../shared/use-toast";
import { useApplyCvUpload, useCvProfiles, useProfile, useSaveProfile } from "../../shared/queries";
import { Btn, Card, Chip, PageHeader, Select, Spinner } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import type { CvAnalysis, CvMatch } from "../../shared/types";
import { Field, SkillsInput } from "../../shared/view-kit";
import { LinkedInOptimizerCard } from "./linkedin-optimizer-card";
import { exportPdf } from "./cv-shared";
import { TRACKS, type Track } from "../../shared/tracks";
import { trackLabel } from "../../shared/track-labels";

/* ---------- CV ---------- */
export function CvMatchPanel({
  match,
  onAddKeyword,
  onApplySummary,
}: {
  match: CvMatch;
  onAddKeyword?: (k: string) => void;
  onApplySummary?: (s: string) => void;
}) {
  const { t } = useTranslation(["cv", "common"]);
  const tone = match.score >= 75 ? "bg-good" : match.score >= 50 ? "bg-star" : "bg-rose-500";
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-ink">{t("reports.match.title")}</span>
        {match.offline && <Chip>{t("shared.offline")}</Chip>}
        {match.semanticFit != null && (
          <Chip tone={match.semanticFit >= 0.75 ? "emerald" : match.semanticFit >= 0.5 ? "amber" : "rose"}>
            {t("reports.match.semanticFit", { percent: Math.round(match.semanticFit * 100) })}
          </Chip>
        )}
        <span className="ml-auto text-2xl font-extrabold text-ink">
          {match.score}
          <span className="text-xs text-ink-dim">{t("reports.per100")}</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full ${tone} rounded-full transition-all`} style={{ width: `${match.score}%` }} />
      </div>
      {match.verdict && <Markdown text={match.verdict} className="text-sm text-ink-dim space-y-2" />}
      {match.matched.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-ink mb-1">{t("reports.match.covered")}</div>
          <div className="flex flex-wrap gap-1.5">
            {match.matched.map((k) => (
              <Chip key={k} tone="emerald">
                {k}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {match.missing.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-rose-600 mb-1">
            {t("reports.match.missingTitle")}
            {onAddKeyword && t("reports.clickToAddHint")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {match.missing.map((k) =>
              onAddKeyword ? (
                <button
                  key={k}
                  onClick={() => onAddKeyword(k)}
                  className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 text-xs font-medium hover:bg-rose-100 transition-colors dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800 dark:hover:bg-rose-900"
                >
                  + {k}
                </button>
              ) : (
                <Chip key={k}>{k}</Chip>
              ),
            )}
          </div>
        </div>
      )}
      {match.suggestions.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-ink-dim mb-1">{t("reports.match.whatToDo")}</div>
          <div className="space-y-1.5">
            {match.suggestions.map((s, i) => (
              <div key={i} className="text-sm">
                <b className="text-ink">{s.title}.</b> <span className="text-ink-dim">{s.fix}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {match.tailoredSummary && (
        <div className="rounded-lg border border-signal/30 bg-signal/10/50 p-2.5 space-y-1.5">
          <div className="text-xs font-semibold text-ink">{t("reports.match.summaryForVacancy")}</div>
          <Markdown text={match.tailoredSummary} className="text-sm text-ink space-y-2" />
          {onApplySummary && (
            <Btn size="sm" onClick={() => onApplySummary(match.tailoredSummary)}>
              {t("reports.match.applyToSummary")}
            </Btn>
          )}
        </div>
      )}
    </Card>
  );
}
export function CVView({ llm }: { llm: boolean }) {
  const { t } = useTranslation(["cv", "common"]);
  const { data: profile } = useProfile();
  const saveProfileMutation = useSaveProfile();
  const applyCvUpload = useApplyCvUpload();
  // Uploading here parses into the structured CV Builder doc as a side effect (r.cvDoc below) —
  // this page predates CV Builder's multiple profiles, so it always targets the first (default)
  // one, same as the Dashboard's read-only ResumeCompleteness card.
  const { data: cvProfiles } = useCvProfiles();
  const defaultCvProfileId = cvProfiles?.[0]?.id;
  const { toast } = useToast();
  const [draft, setDraft] = useUi<{ cvText: string; skills: string[]; domain?: string; track?: Track } | null>("cv.draft", null);
  const [analysis, setAnalysis] = useUi<CvAnalysis | null>("cv.analysis", null);
  const [skillsOut, setSkillsOut] = useUi("cv.skillsOut", "");
  const [busy, setBusy] = useState("");
  // Analysis gets its own busy flag (not the shared `busy` string above) so its button's loading
  // spinner can't be stolen/cleared by an unrelated concurrent action.
  const [busyAnalysis, setBusyAnalysis] = useState(false);
  const cvText = draft?.cvText ?? profile?.cvText ?? "";
  const skills = draft?.skills ?? profile?.skills ?? [];
  const domain = draft?.domain ?? profile?.domain ?? "";
  const track = draft?.track ?? profile?.track;
  const patch = (p: Partial<{ cvText: string; skills: string[]; domain: string; track: Track | undefined }>) =>
    setDraft({ cvText, skills, domain, track, ...p });
  const analyze = async () => {
    setBusyAnalysis(true);
    try {
      setAnalysis(await api.analyzeCV(cvText));
    } finally {
      setBusyAnalysis(false);
    }
  };
  const gen = async () => {
    setBusy("skills");
    try {
      setSkillsOut((await api.skillsUpdate([])).text);
    } finally {
      setBusy("");
    }
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !defaultCvProfileId) return;
    setBusy("upload");
    try {
      const r = await api.uploadCV(defaultCvProfileId, f);
      setDraft({ cvText: r.text, skills: r.skills });
      setAnalysis(r);
      await applyCvUpload(r);
      toast(r.cvDoc ? t("cvPage.toasts.cvAppliedParsed") : t("cvPage.toasts.cvAppliedNoParsing"), "success");
    } catch (err) {
      alert(t("cvPage.toasts.errorPrefix") + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy("");
      e.target.value = "";
    }
  };
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("cvPage.eyebrow")}
        title={t("cvPage.title")}
        subtitle={llm ? t("cvPage.subtitleLlm") : t("cvPage.subtitleOffline")}
        actions={
          <>
            <Btn variant="ghost" onClick={() => exportPdf(t("preview.iframeTitle"), cvText)} disabled={!cvText.trim()}>
              {t("cvPage.exportPdf")}
            </Btn>
            <Btn loading={saveProfileMutation.isPending} onClick={() => saveProfileMutation.mutate({ skills, cvText, domain, track })}>
              {t("shared.saveButton")}
            </Btn>
          </>
        }
      />
      <Card className="!py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-dim">{t("cvPage.uploadLabel")}</span>
          <label
            className={`inline-flex items-center gap-1.5 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer transition-colors ${busy === "upload" ? "bg-star/40 text-on-signal" : "bg-star text-on-signal hover:opacity-90"}`}
          >
            {busy === "upload" ? (
              <>
                <Spinner className="h-3 w-3" /> {t("cvPage.processing")}
              </>
            ) : (
              t("cvPage.uploadCvLabel")
            )}
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={onFile}
              className="hidden"
              disabled={busy === "upload" || !defaultCvProfileId}
            />
          </label>
          <span className="mx-1 h-5 w-px bg-grid" aria-hidden />
          <span className="text-xs font-semibold text-ink-dim">{t("cvPage.aiAnalysisLabel")}</span>
          <Btn
            size="sm"
            variant="ghost"
            onClick={analyze}
            loading={busyAnalysis}
            disabled={!cvText.trim()}
            title={t("cvPage.compareMarketTitle")}
          >
            {t("cvPage.compareMarket")}
          </Btn>
          {/* "Deep review" used to live here as a second AI button. It ran the SAME review the CV
              Builder's "AI Assistant" runs, only over this flat text instead of the structured doc
              — two entry points to one feature, differing in an input the user can't see, and the
              structured one is strictly better (it can point at the section it's talking about and
              apply a rewrite in place). Now it exists once, where the CV actually lives. */}
          <Link
            to="/cvbuilder"
            className="text-xs font-medium text-signal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 rounded"
          >
            {t("cvPage.deepReviewMoved")}
          </Link>
        </div>
        {/* "CV vs market" above is deliberately general — it scores this whole profile, not any
            one role. Checking a single posting has its own, more targeted tools: an unsaved one in
            the Vacancy Analyzer, a tracked one in CV Builder's Compare/Tailor (which also reasons
            over the structured document, not this flat text). */}
        <p className="text-xs text-ink-dim">
          <Trans
            i18nKey="cvPage.compareMarketCaption"
            ns="cv"
            components={{
              analyzerLink: <Link to="/analyzer" className="text-signal hover:underline" />,
              builderLink: <Link to="/cvbuilder" className="text-signal hover:underline" />,
            }}
          />
        </p>
        <details className="text-xs text-ink-dim border-t border-surface-2 pt-2.5">
          <summary className="cursor-pointer select-none hover:text-ink font-medium">{t("cvPage.howItWorksSummary")}</summary>
          <div className="mt-1.5 text-ink-dim">
            <Trans i18nKey="cvPage.howItWorksBody" ns="cv" components={{ b: <b /> }} />
          </div>
        </details>
      </Card>
      <Card className="space-y-2">
        <Field
          label={t("cvPage.domainLabel")}
          value={domain}
          onChange={(v) => patch({ domain: v })}
          placeholder={t("cvPage.domainPlaceholder")}
          maxLength={120}
        />
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("cvPage.trackLabel")}</span>
          <Select
            value={track ?? ""}
            onChange={(e) => patch({ track: e.target.value ? (e.target.value as Track) : undefined })}
            className="w-full mt-0.5"
          >
            <option value="">{t("common:tracks.auto")}</option>
            {TRACKS.map((tr) => (
              <option key={tr} value={tr}>
                {trackLabel(tr)}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("cvPage.cvTextLabel")}</span>
          <textarea
            value={cvText}
            onChange={(e) => patch({ cvText: e.target.value })}
            placeholder={t("cvPage.cvTextPlaceholder")}
            className="w-full mt-0.5 h-32 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <SkillsInput
          label={t("builder.sections.skills.title")}
          skills={skills}
          onChange={(skills) => patch({ skills })}
          placeholder="React, Node, TypeScript…"
        />
      </Card>
      {analysis && (
        <div className="relative">
          <button
            onClick={() => setAnalysis(null)}
            title={t("builder.reports.hide")}
            aria-label={t("builder.reports.hide")}
            className="absolute right-3 top-3 z-10 text-ink-dim hover:text-ink-dim text-sm"
          >
            ✕
          </button>
          <Card>
            <Markdown text={analysis.advice} />
          </Card>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Card className="space-y-2">
          <div className="text-sm font-semibold text-ink">{t("cvPage.updateSkillsTitle")}</div>
          <Btn size="sm" variant="ghost" onClick={gen} loading={busy === "skills"}>
            {t("shared.generate")}
          </Btn>
          {skillsOut && (
            <div className="mt-1 bg-surface-2 border border-grid rounded-lg p-2.5">
              <Markdown text={skillsOut} className="text-xs text-ink space-y-2" />
            </div>
          )}
        </Card>
        <LinkedInOptimizerCard />
      </div>
    </div>
  );
}
