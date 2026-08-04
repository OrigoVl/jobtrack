import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useToast } from "../../shared/use-toast";
import { useApplyCvUpload, useProfile, useSaveProfile, useVacancies } from "../../shared/queries";
import { Btn, Card, Chip, PageHeader, Segmented, Spinner } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import type { CvAnalysis, CvMatch, CvReview, Vacancy } from "../../shared/types";
import { Field, SkillsInput } from "../../shared/view-kit";
import { LinkedInOptimizerCard } from "./linkedin-optimizer-card";

/** Composes vacancy text from fields already saved in the tracker (position/company/level/stack/notes) —
 * the same data set already shown in the vacancy table, assembled into one block for the LLM prompt. */
function vacancyToText(v: Vacancy, t: TFunction<["cv", "common"]>): string {
  return [
    `${v.position || t("builder.vacancyMenu.fallback")}${v.company ? ` — ${v.company}` : ""}`,
    v.level ? `Level: ${v.level}` : "",
    v.stack.length ? `Stack: ${v.stack.join(", ")}` : "",
    v.notes,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Export text to PDF via the browser's print dialog (Save as PDF). Strips the light markdown
 * (**bold**, #headings) that LLM-generated text (e.g. the cover letter) may contain — the print
 * output is plain text via <pre>, so literal asterisks/hashes would otherwise show up on paper. */
function exportPdf(title: string, body: string): void {
  const plain = body.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,4}\s+/gm, "");
  const w = window.open("", "_blank");
  if (!w) {
    alert("Allow pop-ups to export the PDF.");
    return;
  }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<style>body{font-family:Inter,system-ui,-apple-system,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.6}` +
      `h1{font-size:22px;margin:0 0 16px}pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:14px}` +
      // @page{margin:0} removes the browser's print header/footer (date, title,
      // page number) — see the detailed comment next to the same property in cv-doc-utils.ts.
      `@page{margin:0}@media print{body{margin:0;padding:14mm 12mm}}</style></head><body><h1>${esc(title)}</h1><pre>${esc(plain)}</pre></body></html>`,
  );
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

/* ---------- CV ---------- */
export function CvReviewPanel({
  review,
  onAddKeyword,
  onApplyRewrite,
}: {
  review: CvReview;
  onAddKeyword?: (k: string) => void;
  onApplyRewrite?: (before: string, after: string) => void;
}) {
  const { t } = useTranslation(["cv", "common"]);
  const tone = review.score == null ? "bg-ink-dim" : review.score >= 75 ? "bg-signal" : review.score >= 50 ? "bg-alert" : "bg-rose-500";
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-ink">{t("reports.review.title")}</span>
        {review.offline && <Chip>{t("shared.offline")}</Chip>}
        {review.score != null && (
          <span className="ml-auto text-2xl font-extrabold text-ink">
            {review.score}
            <span className="text-xs text-ink-dim">{t("reports.per100")}</span>
          </span>
        )}
      </div>
      {review.score != null && (
        <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
          <div className={`h-full ${tone} rounded-full transition-all`} style={{ width: `${review.score}%` }} />
        </div>
      )}
      {review.summary && <Markdown text={review.summary} className="text-sm text-ink-dim space-y-2" />}
      {review.strengths.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-signal mb-1">{t("reports.review.strengths")}</div>
          <ul className="list-disc pl-5 text-sm text-ink space-y-0.5">
            {review.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {review.issues.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-rose-600 mb-1">{t("reports.review.improve")}</div>
          <div className="space-y-1.5">
            {review.issues.map((it, i) => (
              <div key={i} className="text-sm">
                <b className="text-ink">{it.title}.</b> <span className="text-ink-dim">{it.fix}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {review.keywords.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-ink-dim mb-1">
            {t("reports.review.addKeywordsTitle")}
            {onAddKeyword && t("reports.clickToAddHint")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {review.keywords.map((k) =>
              onAddKeyword ? (
                <button
                  key={k}
                  onClick={() => onAddKeyword(k)}
                  className="rounded-full bg-signal/10 text-signal border border-signal/30 px-2.5 py-0.5 text-xs font-medium hover:bg-signal/20 transition-colors"
                >
                  + {k}
                </button>
              ) : (
                <Chip key={k} tone="indigo">
                  {k}
                </Chip>
              ),
            )}
          </div>
        </div>
      )}
      {review.rewrites.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-ink-dim mb-1">{t("reports.review.rewriteStronger")}</div>
          <div className="space-y-2">
            {review.rewrites.map((rw, i) => (
              <div key={i} className="text-sm rounded-lg border border-grid p-2 space-y-1">
                <div className="text-rose-600">− {rw.before}</div>
                <div className="text-signal">+ {rw.after}</div>
                {onApplyRewrite && (
                  <Btn size="sm" variant="ghost" onClick={() => onApplyRewrite(rw.before, rw.after)}>
                    {t("reports.review.applyToBullet")}
                  </Btn>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
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
  const tone = match.score >= 75 ? "bg-signal" : match.score >= 50 ? "bg-alert" : "bg-rose-500";
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
          <div className="text-xs font-semibold text-signal mb-1">{t("reports.match.covered")}</div>
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
          <div className="text-xs font-semibold text-signal">{t("reports.match.summaryForVacancy")}</div>
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
  const { data: vacancies = [] } = useVacancies();
  const saveProfileMutation = useSaveProfile();
  const applyCvUpload = useApplyCvUpload();
  const { toast } = useToast();
  const [draft, setDraft] = useUi<{ cvText: string; skills: string[]; domain?: string } | null>("cv.draft", null);
  const [analysis, setAnalysis] = useUi<CvAnalysis | null>("cv.analysis", null);
  const [review, setReview] = useUi<CvReview | null>("cv.review", null);
  const [skillsOut, setSkillsOut] = useUi("cv.skillsOut", "");
  const [cover, setCover] = useUi("cv.cover", "");
  const [vacText, setVacText] = useUi("cv.vacText", "");
  const [coverVacId, setCoverVacId] = useUi<number>("cv.coverVacId", 0);
  const [coverUrl, setCoverUrl] = useUi("cv.coverUrl", "");
  const [busy, setBusy] = useState("");
  // Analysis/review get their own busy flags (not the shared `busy` string above) so their
  // buttons' loading spinners can't be stolen/cleared by an unrelated concurrent action — and a
  // single `activeReport` tab so running the second AI check never visually "buries"/closes the
  // first one, it just becomes one tab-click away instead of disappearing off-screen.
  const [busyAnalysis, setBusyAnalysis] = useState(false);
  const [busyReview, setBusyReview] = useState(false);
  const [activeReport, setActiveReport] = useUi<"analysis" | "review">("cv.activeReport", "analysis");
  const coverCompany = vacancies.find((v) => v.id === coverVacId)?.company || "";
  const pickCoverVacancy = (id: number) => {
    setCoverVacId(id);
    const vac = vacancies.find((v) => v.id === id);
    if (vac) setVacText(vacancyToText(vac, t));
  };
  const fetchCoverUrl = async () => {
    if (!coverUrl.trim()) return;
    setBusy("cover-url");
    try {
      setCoverVacId(0);
      setVacText((await api.fetchVacancyUrl(coverUrl.trim())).text);
      toast(t("cvPage.toasts.vacancyTextLoaded"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("cvPage.toasts.loadPageError"), "error");
    } finally {
      setBusy("");
    }
  };
  const cvText = draft?.cvText ?? profile?.cvText ?? "";
  const skills = draft?.skills ?? profile?.skills ?? [];
  const domain = draft?.domain ?? profile?.domain ?? "";
  const patch = (p: Partial<{ cvText: string; skills: string[]; domain: string }>) => setDraft({ cvText, skills, domain, ...p });
  const analyze = async () => {
    setBusyAnalysis(true);
    try {
      setAnalysis(await api.analyzeCV(cvText));
      setActiveReport("analysis");
    } finally {
      setBusyAnalysis(false);
    }
  };
  const doReview = async () => {
    setBusyReview(true);
    try {
      setReview(await api.reviewCV(cvText));
      setActiveReport("review");
    } finally {
      setBusyReview(false);
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
  const genCover = async () => {
    setBusy("cover");
    try {
      setCover((await api.coverLetter(vacText, coverCompany)).text);
    } finally {
      setBusy("");
    }
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy("upload");
    try {
      const r = await api.uploadCV(f);
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
        title={t("cvPage.title")}
        subtitle={llm ? t("cvPage.subtitleLlm") : t("cvPage.subtitleOffline")}
        actions={
          <>
            <Btn variant="ghost" onClick={() => exportPdf(t("preview.iframeTitle"), cvText)} disabled={!cvText.trim()}>
              {t("cvPage.exportPdf")}
            </Btn>
            <Btn loading={saveProfileMutation.isPending} onClick={() => saveProfileMutation.mutate({ skills, cvText, domain })}>
              {t("shared.saveButton")}
            </Btn>
          </>
        }
      />
      <Card className="!py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-dim">{t("cvPage.uploadLabel")}</span>
          <label
            className={`inline-flex items-center gap-1.5 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer transition-colors ${busy === "upload" ? "bg-signal/40 text-white" : "bg-signal text-white hover:opacity-90"}`}
          >
            {busy === "upload" ? (
              <>
                <Spinner className="h-3 w-3" /> {t("cvPage.processing")}
              </>
            ) : (
              t("cvPage.uploadCvLabel")
            )}
            <input type="file" accept=".pdf,.docx,.txt" onChange={onFile} className="hidden" disabled={busy === "upload"} />
          </label>
          <span className="mx-1 h-5 w-px bg-grid" aria-hidden />
          <span className="text-xs font-semibold text-ink-dim">{t("cvPage.aiAnalysisLabel")}</span>
          <Btn size="sm" variant="ghost" onClick={analyze} loading={busyAnalysis} disabled={!cvText.trim()}>
            {t("cvPage.compareMarket")}
          </Btn>
          <Btn size="sm" variant="ghost" onClick={doReview} loading={busyReview} disabled={!cvText.trim()}>
            {t("cvPage.deepReview")}
          </Btn>
        </div>
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
      {(analysis || review) &&
        (() => {
          // Which reports actually exist right now — falls back to whatever's available if the
          // remembered tab was hidden/cleared, so the dismiss (✕) button below always acts on
          // what's actually on screen instead of a stale tab selection.
          const available: ("analysis" | "review")[] = [
            ...(analysis ? (["analysis"] as const) : []),
            ...(review ? (["review"] as const) : []),
          ];
          const current = available.includes(activeReport) ? activeReport : available[0];
          return (
            <div className="space-y-2">
              {available.length > 1 && (
                <Segmented
                  value={current}
                  onChange={setActiveReport}
                  options={[
                    { value: "analysis", label: t("cvPage.compareMarket") },
                    { value: "review", label: t("cvPage.deepReview") },
                  ]}
                />
              )}
              <div className="relative">
                <button
                  onClick={() => (current === "analysis" ? setAnalysis(null) : setReview(null))}
                  title={t("builder.reports.hide")}
                  aria-label={t("builder.reports.hide")}
                  className="absolute right-3 top-3 z-10 text-ink-dim hover:text-ink-dim text-sm"
                >
                  ✕
                </button>
                {current === "analysis" && analysis ? (
                  <Card>
                    <Markdown text={analysis.advice} />
                  </Card>
                ) : (
                  review && <CvReviewPanel review={review} />
                )}
              </div>
            </div>
          );
        })()}
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
        <Card className="space-y-2">
          <div className="text-sm font-semibold text-ink">{t("cvPage.coverLetterTitle")}</div>
          {vacancies.length > 0 && (
            <select
              value={coverVacId}
              onChange={(e) => pickCoverVacancy(Number(e.target.value))}
              aria-label={t("cvPage.coverVacancyAria")}
              className="w-full bg-surface-2 border border-grid rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-signal/50"
            >
              <option value={0}>{t("cvPage.selectVacancyFromTracker")}</option>
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.position}
                  {v.company ? ` — ${v.company}` : ""}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-1.5">
            <input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchCoverUrl()}
              aria-label={t("cvPage.coverUrlAria")}
              placeholder={t("cvPage.coverUrlPlaceholder")}
              className="flex-1 min-w-0 bg-surface-2 border border-grid rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
            <Btn size="sm" variant="subtle" onClick={fetchCoverUrl} loading={busy === "cover-url"} disabled={!coverUrl.trim()}>
              {t("cvPage.load")}
            </Btn>
          </div>
          <textarea
            value={vacText}
            onChange={(e) => {
              setVacText(e.target.value);
              setCoverVacId(0);
            }}
            aria-label={t("cvPage.coverTextAria")}
            placeholder={t("cvPage.coverTextPlaceholder")}
            className="w-full h-16 bg-surface-2 border border-grid rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <div className="flex gap-2 flex-wrap">
            <Btn size="sm" variant="ghost" onClick={genCover} loading={busy === "cover"} disabled={!vacText.trim()}>
              {t("cvPage.generateLetter")}
            </Btn>
            {cover && (
              <Btn size="sm" variant="ghost" onClick={() => exportPdf(t("cvPage.coverLetterPdfTitle"), cover)}>
                {t("shared.pdfButton")}
              </Btn>
            )}
          </div>
          {cover && (
            <div className="mt-1 bg-surface-2 border border-grid rounded-lg p-2.5">
              <Markdown text={cover} className="text-xs text-ink space-y-2" />
            </div>
          )}
        </Card>
      </div>
      <LinkedInOptimizerCard />
    </div>
  );
}
