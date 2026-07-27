import { useState } from "react";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useToast } from "../../shared/use-toast";
import { useApplyCvUpload, useProfile, useSaveProfile } from "../../shared/queries";
import { Btn, Card, Chip, PageHeader } from "../../shared/ui";
import type { CvAnalysis, CvMatch, CvReview } from "../../shared/types";
import { Field } from "../../shared/view-kit";

/** Експорт тексту у PDF через діалог друку браузера (Зберегти як PDF). */
function exportPdf(title: string, body: string): void {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Дозволь спливаючі вікна, щоб експортувати PDF.");
    return;
  }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(
    `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<style>body{font-family:Inter,system-ui,-apple-system,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.6}` +
      `h1{font-size:22px;margin:0 0 16px}pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:14px}` +
      // @page{margin:0} прибирає системний заголовок/підвал друку (дата, назва, URL, номер
      // сторінки) — див. детальний коментар біля тієї ж властивості в cv-doc-utils.ts.
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
        <span className="font-semibold text-slate-800">🔎 Рев'ю резюме</span>
        {review.offline && <Chip>офлайн</Chip>}
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
          <div className="text-xs font-semibold text-emerald-600 mb-1">✓ Сильні сторони</div>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
            {review.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {review.issues.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-rose-600 mb-1">△ Що покращити</div>
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
            🔑 Додай ключові слова (ATS / LinkedIn-пошук){onAddKeyword && " — клікни, щоб додати в навички"}
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
          <div className="text-xs font-semibold text-slate-500 mb-1">✍️ Переписати сильніше (результат замість процесу)</div>
          <div className="space-y-2">
            {review.rewrites.map((rw, i) => (
              <div key={i} className="text-sm rounded-lg border border-slate-200 p-2 space-y-1">
                <div className="text-rose-600">− {rw.before}</div>
                <div className="text-emerald-700">+ {rw.after}</div>
                {onApplyRewrite && (
                  <Btn size="sm" variant="ghost" onClick={() => onApplyRewrite(rw.before, rw.after)}>
                    ↳ застосувати до пункту
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
        <span className="font-semibold text-slate-800">🎯 Відповідність вакансії</span>
        {match.offline && <Chip>офлайн</Chip>}
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
          <div className="text-xs font-semibold text-emerald-600 mb-1">✓ Вже покриваєш</div>
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
            △ Бракує під цю вакансію{onAddKeyword && " — клікни, щоб додати в навички"}
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
          <div className="text-xs font-semibold text-slate-500 mb-1">💡 Що зробити під вакансію</div>
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
          <div className="text-xs font-semibold text-indigo-600">✍️ Summary під цю вакансію</div>
          <p className="text-sm text-slate-700">{match.tailoredSummary}</p>
          {onApplySummary && (
            <Btn size="sm" onClick={() => onApplySummary(match.tailoredSummary)}>
              Застосувати в summary
            </Btn>
          )}
        </div>
      )}
    </Card>
  );
}
export function CVView({ llm }: { llm: boolean }) {
  const { data: profile } = useProfile();
  const saveProfileMutation = useSaveProfile();
  const applyCvUpload = useApplyCvUpload();
  const { toast } = useToast();
  const [draft, setDraft] = useUi<{ cvText: string; skills: string[]; domain?: string } | null>("cv.draft", null);
  const [analysis, setAnalysis] = useUi<CvAnalysis | null>("cv.analysis", null);
  const [review, setReview] = useUi<CvReview | null>("cv.review", null);
  const [skillsOut, setSkillsOut] = useUi("cv.skillsOut", "");
  const [cover, setCover] = useUi("cv.cover", "");
  const [vacText, setVacText] = useUi("cv.vacText", "");
  const [busy, setBusy] = useState("");
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
      setCover((await api.coverLetter(vacText, "")).text);
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
        r.cvDoc ? "CV застосовано всюди + розібрано в Конструктор CV" : "CV застосовано всюди (увімкни LLM для авто-розбору в конструктор)",
        "success",
      );
    } catch (err) {
      alert("Помилка: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy("");
      e.target.value = "";
    }
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="CV та рекомендації"
        subtitle={
          llm
            ? "Аналіз резюме проти попиту ринку + генерація секції Skills і cover letter."
            : "Офлайн-режим — увімкни LLM у server/.env для розумних порад."
        }
        actions={
          <>
            <Btn variant="ghost" onClick={() => exportPdf("CV", cvText)} disabled={!cvText.trim()}>
              ⬇️ CV у PDF
            </Btn>
            <Btn onClick={() => saveProfileMutation.mutate({ skills, cvText, domain })}>💾 Зберегти</Btn>
          </>
        }
      />
      <Card className="!py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Завантажити:</span>
          <label
            className={`inline-flex items-center gap-1.5 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer transition-colors ${busy === "upload" ? "bg-indigo-300 text-white" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}
          >
            {busy === "upload" ? "⏳ Обробляю…" : "📎 CV (PDF / DOCX / TXT)"}
            <input type="file" accept=".pdf,.docx,.txt" onChange={onFile} className="hidden" disabled={busy === "upload"} />
          </label>
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
          <span className="text-xs font-semibold text-slate-500">AI-аналіз:</span>
          <Btn size="sm" variant="ghost" onClick={analyze} disabled={busy === "cv" || !cvText.trim()}>
            {busy === "cv" ? "…" : "🔍 CV vs ринок"}
          </Btn>
          <Btn size="sm" variant="ghost" onClick={doReview} disabled={busy === "review" || !cvText.trim()}>
            {busy === "review" ? "…" : "🔎 Глибокий рев'ю"}
          </Btn>
        </div>
        <details className="text-xs text-slate-500 border-t border-slate-100 pt-2.5">
          <summary className="cursor-pointer select-none hover:text-slate-700 font-medium">
            Як це працює та як завантажити з LinkedIn?
          </summary>
          <div className="mt-1.5 text-slate-600">
            Одне завантаження — і CV працює <b>всюди</b>: аналіз ринку, роудмапа, план навчання, рекомендації + авто-розбір на секції в{" "}
            <b>Конструкторі CV</b>. <b>LinkedIn:</b> профіль → «More» → «Save to PDF» → завантаж сюди (пряме парсення LinkedIn заборонене
            його ToS).
          </div>
        </details>
      </Card>
      <Card className="space-y-2">
        <Field
          label="Професія / роль — під неї підлаштовуються всі AI-поради"
          value={domain}
          onChange={(v) => patch({ domain: v })}
          placeholder="напр. Full-Stack розробник, UX-дизайнер, Маркетолог…"
          maxLength={120}
        />
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Текст CV (можна редагувати або вставити вручну)</span>
          <textarea
            value={cvText}
            onChange={(e) => patch({ cvText: e.target.value })}
            placeholder="Встав або відредагуй текст свого резюме…"
            className="w-full mt-0.5 h-32 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>
        <Field
          label="Навички (через кому)"
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
          <div className="text-sm font-semibold text-slate-700">🔧 Оновити секцію Skills</div>
          <Btn size="sm" variant="ghost" onClick={gen} disabled={busy === "skills"}>
            {busy === "skills" ? "…" : "Згенерувати"}
          </Btn>
          {skillsOut && (
            <pre className="mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs whitespace-pre-wrap text-slate-700">
              {skillsOut}
            </pre>
          )}
        </Card>
        <Card className="space-y-2">
          <div className="text-sm font-semibold text-slate-700">✉️ Cover letter під вакансію</div>
          <textarea
            value={vacText}
            onChange={(e) => setVacText(e.target.value)}
            aria-label="Текст вакансії для cover letter"
            placeholder="Текст вакансії…"
            className="w-full h-16 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex gap-2 flex-wrap">
            <Btn size="sm" variant="ghost" onClick={genCover} disabled={busy === "cover"}>
              {busy === "cover" ? "…" : "Згенерувати лист"}
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
