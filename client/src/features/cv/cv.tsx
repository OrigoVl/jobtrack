import { useState } from "react";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useToast } from "../../shared/use-toast";
import { useApplyCvUpload, useProfile, useSaveProfile, useVacancies } from "../../shared/queries";
import { Btn, Card, Chip, PageHeader, Spinner } from "../../shared/ui";
import type { CvAnalysis, CvMatch, CvReview, Vacancy } from "../../shared/types";
import { Field } from "../../shared/view-kit";

/** Composes vacancy text from fields already saved in the tracker (position/company/level/stack/notes) —
 * the same data set already shown in the vacancy table, assembled into one block for the LLM prompt. */
function vacancyToText(v: Vacancy): string {
  return [
    `${v.position || "Vacancy"}${v.company ? ` — ${v.company}` : ""}`,
    v.level ? `Level: ${v.level}` : "",
    v.stack.length ? `Stack: ${v.stack.join(", ")}` : "",
    v.notes,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Export text to PDF via the browser's print dialog (Save as PDF). */
function exportPdf(title: string, body: string): void {
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
      `@page{margin:0}@media print{body{margin:0;padding:14mm 12mm}}</style></head><body><h1>${esc(title)}</h1><pre>${esc(body)}</pre></body></html>`,
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
  const tone =
    review.score == null ? "bg-slate-400" : review.score >= 75 ? "bg-emerald-500" : review.score >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-800">🔎 CV Review</span>
        {review.offline && <Chip>offline</Chip>}
        {review.score != null && (
          <span className="ml-auto text-2xl font-extrabold text-slate-800">
            {review.score}
            <span className="text-xs text-slate-400">/100</span>
          </span>
        )}
      </div>
      {review.score != null && (
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full ${tone} rounded-full transition-all`} style={{ width: `${review.score}%` }} />
        </div>
      )}
      {review.summary && <p className="text-sm text-slate-600">{review.summary}</p>}
      {review.strengths.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-emerald-600 mb-1">✓ Strengths</div>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
            {review.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {review.issues.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-rose-600 mb-1">△ What to improve</div>
          <div className="space-y-1.5">
            {review.issues.map((it, i) => (
              <div key={i} className="text-sm">
                <b className="text-slate-800">{it.title}.</b> <span className="text-slate-600">{it.fix}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {review.keywords.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1">
            🔑 Add keywords (ATS / LinkedIn search){onAddKeyword && " — click to add to skills"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {review.keywords.map((k) =>
              onAddKeyword ? (
                <button
                  key={k}
                  onClick={() => onAddKeyword(k)}
                  className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium hover:bg-indigo-100 transition-colors"
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
          <div className="text-xs font-semibold text-slate-500 mb-1">✍️ Rewrite stronger (outcome instead of process)</div>
          <div className="space-y-2">
            {review.rewrites.map((rw, i) => (
              <div key={i} className="text-sm rounded-lg border border-slate-200 p-2 space-y-1">
                <div className="text-rose-600">− {rw.before}</div>
                <div className="text-emerald-700">+ {rw.after}</div>
                {onApplyRewrite && (
                  <Btn size="sm" variant="ghost" onClick={() => onApplyRewrite(rw.before, rw.after)}>
                    ↳ apply to bullet
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
  const tone = match.score >= 75 ? "bg-emerald-500" : match.score >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-800">🎯 Vacancy match</span>
        {match.offline && <Chip>offline</Chip>}
        <span className="ml-auto text-2xl font-extrabold text-slate-800">
          {match.score}
          <span className="text-xs text-slate-400">/100</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${tone} rounded-full transition-all`} style={{ width: `${match.score}%` }} />
      </div>
      {match.verdict && <p className="text-sm text-slate-600">{match.verdict}</p>}
      {match.matched.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-emerald-600 mb-1">✓ Already covered</div>
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
            △ Missing for this vacancy{onAddKeyword && " — click to add to skills"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {match.missing.map((k) =>
              onAddKeyword ? (
                <button
                  key={k}
                  onClick={() => onAddKeyword(k)}
                  className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 text-xs font-medium hover:bg-rose-100 transition-colors"
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
          <div className="text-xs font-semibold text-slate-500 mb-1">💡 What to do for this vacancy</div>
          <div className="space-y-1.5">
            {match.suggestions.map((s, i) => (
              <div key={i} className="text-sm">
                <b className="text-slate-800">{s.title}.</b> <span className="text-slate-600">{s.fix}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {match.tailoredSummary && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5 space-y-1.5">
          <div className="text-xs font-semibold text-indigo-600">✍️ Summary for this vacancy</div>
          <p className="text-sm text-slate-700">{match.tailoredSummary}</p>
          {onApplySummary && (
            <Btn size="sm" onClick={() => onApplySummary(match.tailoredSummary)}>
              Apply to summary
            </Btn>
          )}
        </div>
      )}
    </Card>
  );
}
export function CVView({ llm }: { llm: boolean }) {
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
  const coverCompany = vacancies.find((v) => v.id === coverVacId)?.company || "";
  const pickCoverVacancy = (id: number) => {
    setCoverVacId(id);
    const vac = vacancies.find((v) => v.id === id);
    if (vac) setVacText(vacancyToText(vac));
  };
  const fetchCoverUrl = async () => {
    if (!coverUrl.trim()) return;
    setBusy("cover-url");
    try {
      setCoverVacId(0);
      setVacText((await api.fetchVacancyUrl(coverUrl.trim())).text);
      toast("Vacancy text loaded", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load the page", "error");
    } finally {
      setBusy("");
    }
  };
  const cvText = draft?.cvText ?? profile?.cvText ?? "";
  const skills = draft?.skills ?? profile?.skills ?? [];
  const domain = draft?.domain ?? profile?.domain ?? "";
  const patch = (p: Partial<{ cvText: string; skills: string[]; domain: string }>) => setDraft({ cvText, skills, domain, ...p });
  const analyze = async () => {
    setBusy("cv");
    try {
      setAnalysis(await api.analyzeCV(cvText));
    } finally {
      setBusy("");
    }
  };
  const doReview = async () => {
    setBusy("review");
    try {
      setReview(await api.reviewCV(cvText));
    } finally {
      setBusy("");
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
      toast(
        r.cvDoc
          ? "CV applied everywhere + parsed into the CV Builder"
          : "CV applied everywhere (enable LLM for auto-parsing into the builder)",
        "success",
      );
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy("");
      e.target.value = "";
    }
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="CV and recommendations"
        subtitle={
          llm
            ? "CV analysis against market demand + generation of the Skills section and cover letter."
            : "Offline mode — enable LLM in server/.env for smart advice."
        }
        actions={
          <>
            <Btn variant="ghost" onClick={() => exportPdf("CV", cvText)} disabled={!cvText.trim()}>
              ⬇️ CV to PDF
            </Btn>
            <Btn loading={saveProfileMutation.isPending} onClick={() => saveProfileMutation.mutate({ skills, cvText, domain })}>
              💾 Save
            </Btn>
          </>
        }
      />
      <Card className="!py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Upload:</span>
          <label
            className={`inline-flex items-center gap-1.5 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer transition-colors ${busy === "upload" ? "bg-indigo-300 text-white" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}
          >
            {busy === "upload" ? (
              <>
                <Spinner className="h-3 w-3" /> Processing…
              </>
            ) : (
              "📎 CV (PDF / DOCX / TXT)"
            )}
            <input type="file" accept=".pdf,.docx,.txt" onChange={onFile} className="hidden" disabled={busy === "upload"} />
          </label>
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
          <span className="text-xs font-semibold text-slate-500">AI analysis:</span>
          <Btn size="sm" variant="ghost" onClick={analyze} loading={busy === "cv"} disabled={!cvText.trim()}>
            🔍 CV vs market
          </Btn>
          <Btn size="sm" variant="ghost" onClick={doReview} loading={busy === "review"} disabled={!cvText.trim()}>
            🔎 Deep review
          </Btn>
        </div>
        <details className="text-xs text-slate-500 border-t border-slate-100 pt-2.5">
          <summary className="cursor-pointer select-none hover:text-slate-700 font-medium">
            How does this work, and how do I upload from LinkedIn?
          </summary>
          <div className="mt-1.5 text-slate-600">
            One upload — and your CV works <b>everywhere</b>: market analysis, roadmap, learning plan, recommendations + auto-parsing into
            sections in <b>the CV Builder</b>. <b>LinkedIn:</b> profile → «More» → «Save to PDF» → upload it here (direct LinkedIn parsing
            is forbidden by its ToS).
          </div>
        </details>
      </Card>
      <Card className="space-y-2">
        <Field
          label="Profession / role — all AI advice adapts to it"
          value={domain}
          onChange={(v) => patch({ domain: v })}
          placeholder="e.g. Full-Stack developer, UX designer, Marketer…"
          maxLength={120}
        />
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">CV text (you can edit or paste manually)</span>
          <textarea
            value={cvText}
            onChange={(e) => patch({ cvText: e.target.value })}
            placeholder="Paste or edit your resume text…"
            className="w-full mt-0.5 h-32 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>
        <Field
          label="Skills (comma-separated)"
          value={skills.join(", ")}
          onChange={(v) =>
            patch({
              skills: v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="React, Node, TypeScript…"
        />
      </Card>
      {analysis && (
        <Card>
          <div className="text-sm whitespace-pre-wrap text-slate-700">{analysis.advice}</div>
        </Card>
      )}
      {review && <CvReviewPanel review={review} />}
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Card className="space-y-2">
          <div className="text-sm font-semibold text-slate-700">🔧 Update Skills section</div>
          <Btn size="sm" variant="ghost" onClick={gen} loading={busy === "skills"}>
            Generate
          </Btn>
          {skillsOut && (
            <pre className="mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs whitespace-pre-wrap text-slate-700">
              {skillsOut}
            </pre>
          )}
        </Card>
        <Card className="space-y-2">
          <div className="text-sm font-semibold text-slate-700">✉️ Cover letter for a vacancy</div>
          {vacancies.length > 0 && (
            <select
              value={coverVacId}
              onChange={(e) => pickCoverVacancy(Number(e.target.value))}
              aria-label="Select a vacancy from the tracker for the cover letter"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value={0}>— select a vacancy from the tracker —</option>
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
              aria-label="Vacancy link for the cover letter"
              placeholder="…or paste a vacancy link"
              className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <Btn size="sm" variant="subtle" onClick={fetchCoverUrl} loading={busy === "cover-url"} disabled={!coverUrl.trim()}>
              Load
            </Btn>
          </div>
          <textarea
            value={vacText}
            onChange={(e) => {
              setVacText(e.target.value);
              setCoverVacId(0);
            }}
            aria-label="Vacancy text for the cover letter"
            placeholder="…or paste the vacancy text manually"
            className="w-full h-16 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex gap-2 flex-wrap">
            <Btn size="sm" variant="ghost" onClick={genCover} loading={busy === "cover"} disabled={!vacText.trim()}>
              Generate letter
            </Btn>
            {cover && (
              <Btn size="sm" variant="ghost" onClick={() => exportPdf("Cover Letter", cover)}>
                ⬇️ PDF
              </Btn>
            )}
          </div>
          {cover && (
            <pre className="mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs whitespace-pre-wrap text-slate-700">
              {cover}
            </pre>
          )}
        </Card>
      </div>
    </div>
  );
}
