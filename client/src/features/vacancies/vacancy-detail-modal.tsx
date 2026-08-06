import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useContacts, useProfile, useUpdateVacancy } from "../../shared/queries";
import { Btn, Segmented, Spinner } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import { SkillsInput } from "../../shared/view-kit";
import { STATUSES, type CvMatch, type Fit, type Vacancy, type VacancyStatus } from "../../shared/types";
import { fitLabel, fitText } from "../../shared/fit-tone";
import { statusLabel } from "../../shared/status-labels";
import { STATUS_SELECT_CLASS, DEFAULT_STATUS_SELECT_CLASS } from "../../shared/status-tone";
import { DateInput } from "../../shared/date-input";
import { SimilarVacanciesButton } from "./similar-vacancies-button";
import { CvMatchPanel } from "../cv/cv";

/** Composes a job-text block from the vacancy's own tracked fields (position/company/level/
 * salary/stack/notes) for the cover-letter/fit-match LLM prompts — this app never persists the
 * raw scraped posting text, only the structured fields already shown in the table (same
 * "assemble from what we already have" approach as cv.tsx's own vacancyToText). Kept as its own
 * copy rather than importing cv.tsx's/cv-builder.tsx's near-identical helpers: those two already
 * differ from each other in exactly which fields they include, and this one needs salary too —
 * three small, independent compositions are safer than one shared one that has to please all
 * three call sites' slightly different needs. */
function vacancyJobText(v: Vacancy): string {
  return [
    `${v.position || "—"}${v.company ? ` — ${v.company}` : ""}`,
    v.level ? `Level: ${v.level}` : "",
    v.salary ? `Salary: ${v.salary}` : "",
    v.stack.length ? `Stack: ${v.stack.join(", ")}` : "",
    v.notes,
  ]
    .filter(Boolean)
    .join("\n");
}

export type Tab = "overview" | "cover" | "fit";

/**
 * The "Jira issue"-style hub for one vacancy: click any vacancy (table row's index button, or a
 * Kanban card) to open this instead of hunting for the same functionality scattered across the
 * CV and CV Builder pages — cover-letter generation and skills-fit analysis, both scoped to THIS
 * vacancy, plus every editable field already in the table (status/fit/salary/dates/notes) and the
 * vacancy's linked contacts, in one place.
 */
export function VacancyDetailModal({
  vacancy,
  onClose,
  initialTab = "overview",
}: {
  vacancy: Vacancy;
  onClose: () => void;
  /** Lets a caller land directly on a specific tab — e.g. the Analyzer page's "Детальніше" link
   * opens straight on "fit" instead of making the user click the tab switcher themselves. Every
   * existing call site omits this and keeps the original default. */
  initialTab?: Tab;
}) {
  const { t } = useTranslation(["vacancies", "cv", "common"]);
  const { data: profile } = useProfile();
  const { data: contacts = [] } = useContacts();
  const updateMutation = useUpdateVacancy();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [coverText, setCoverText] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [match, setMatch] = useState<CvMatch | null>(null);
  const [matchBusy, setMatchBusy] = useState(false);

  // Escape closes, same convention as the confirm dialog / every other overlay in this app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const jobText = vacancyJobText(vacancy);
  const linkedContacts = contacts.filter((c) => c.vacancyId === vacancy.id);
  const hasCvText = !!profile?.cvText?.trim();

  const genCover = async () => {
    setCoverBusy(true);
    setCoverError(false);
    try {
      setCoverText((await api.coverLetter(jobText, vacancy.company)).text);
    } catch {
      setCoverError(true);
    } finally {
      setCoverBusy(false);
    }
  };
  const genMatch = async () => {
    setMatchBusy(true);
    try {
      setMatch(await api.matchVacancy(profile?.cvText ?? "", vacancy.position, jobText));
    } finally {
      setMatchBusy(false);
    }
  };

  const tabOptions: { value: Tab; label: string }[] = [
    { value: "overview", label: t("detail.tabs.overview") },
    { value: "cover", label: t("detail.tabs.cover") },
    { value: "fit", label: t("detail.tabs.fit") },
  ];

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-ink/50 p-3 md:p-6" onClick={onClose}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${vacancy.position || t("detail.untitled")} — ${vacancy.company}`}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl bg-surface border border-grid shadow-lg flex flex-col"
      >
        {/* Header — every field here is the same onBlur/onChange-commits-immediately convention
            as the table row (see updateMutation.mutate calls below): editing here is exactly as
            authoritative as editing there, same mutation, same cache. */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3 border-b border-surface-2">
          <div className="min-w-0 flex-1 space-y-1">
            <input
              key={`position-${vacancy.id}`}
              defaultValue={vacancy.position}
              onBlur={(e) => updateMutation.mutate({ id: vacancy.id, patch: { position: e.target.value } })}
              placeholder={t("detail.untitled")}
              aria-label={t("detail.positionAriaLabel")}
              className="w-full font-display text-lg font-bold text-ink bg-transparent outline-none focus:ring-1 focus:ring-signal/40 rounded px-1 -mx-1"
            />
            <input
              key={`company-${vacancy.id}`}
              defaultValue={vacancy.company}
              onBlur={(e) => updateMutation.mutate({ id: vacancy.id, patch: { company: e.target.value } })}
              placeholder={t("detail.companyAriaLabel")}
              aria-label={t("detail.companyAriaLabel")}
              className="w-full text-sm text-ink-dim bg-transparent outline-none focus:ring-1 focus:ring-signal/40 rounded px-1 -mx-1"
            />
            <div className="flex items-center gap-1.5 pt-0.5">
              <input
                key={`url-${vacancy.id}`}
                type="url"
                defaultValue={vacancy.url}
                onBlur={(e) => updateMutation.mutate({ id: vacancy.id, patch: { url: e.target.value } })}
                placeholder={t("table.vacancyLinkPlaceholder")}
                aria-label={t("table.vacancyLinkAriaLabel", { company: vacancy.company })}
                className="flex-1 min-w-0 text-xs text-signal bg-transparent outline-none focus:ring-1 focus:ring-signal/40 rounded px-1 -mx-1"
              />
              {vacancy.url && (
                <a
                  href={vacancy.url}
                  target="_blank"
                  rel="noreferrer"
                  title={t("detail.openOriginal")}
                  aria-label={t("detail.openOriginal")}
                  className="shrink-0 text-signal text-xs hover:opacity-80"
                >
                  ↗
                </a>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common:actions.close")}
            className="shrink-0 text-ink-dim hover:text-ink text-lg leading-none p-1 -m-1 rounded-lg hover:bg-surface-2"
          >
            ✕
          </button>
        </div>

        {/* Metadata strip — the same editable controls already in the table, so changing them
            here is exactly as authoritative as changing them there (same mutation, same cache). */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-surface-2 bg-surface-2/40">
          <select
            defaultValue={vacancy.status}
            onChange={(e) => updateMutation.mutate({ id: vacancy.id, patch: { status: e.target.value } })}
            className={`border rounded px-2 py-1 text-xs font-medium ${
              STATUS_SELECT_CLASS[vacancy.status as VacancyStatus] ?? DEFAULT_STATUS_SELECT_CLASS
            }`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <select
            defaultValue={vacancy.fit}
            onChange={(e) => updateMutation.mutate({ id: vacancy.id, patch: { fit: e.target.value as Fit } })}
            className={`bg-surface border border-grid rounded px-2 py-1 text-xs font-medium ${fitText[vacancy.fit]}`}
          >
            <option value="high">{fitLabel("high")}</option>
            <option value="med">{fitLabel("med")}</option>
            <option value="low">{fitLabel("low")}</option>
          </select>
          <input
            key={`level-${vacancy.id}`}
            defaultValue={vacancy.level}
            onBlur={(e) => updateMutation.mutate({ id: vacancy.id, patch: { level: e.target.value } })}
            placeholder={t("detail.levelPlaceholder")}
            aria-label={t("detail.levelAriaLabel")}
            className="bg-surface border border-grid rounded px-2 py-1 text-xs w-20 outline-none focus:ring-1 focus:ring-signal/40"
          />
          <input
            defaultValue={vacancy.salary}
            onBlur={(e) => updateMutation.mutate({ id: vacancy.id, patch: { salary: e.target.value } })}
            placeholder={t("table.salaryPlaceholder")}
            aria-label={t("table.salaryAriaLabel", { company: vacancy.company })}
            className="bg-surface border border-grid rounded px-2 py-1 text-xs w-24 outline-none focus:ring-1 focus:ring-signal/40"
          />
          <label className="flex items-center gap-1.5 text-xs text-ink-dim">
            {t("table.applied")}
            <DateInput
              value={vacancy.applied}
              onChange={(iso) => updateMutation.mutate({ id: vacancy.id, patch: { applied: iso } })}
              aria-label={t("table.appliedDateAriaLabel", { company: vacancy.company })}
              className="bg-surface border border-grid rounded px-1.5 py-1 text-xs w-28 outline-none focus:ring-1 focus:ring-signal/40"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-dim">
            {t("table.nextStep")}
            <DateInput
              value={vacancy.next}
              onChange={(iso) => updateMutation.mutate({ id: vacancy.id, patch: { next: iso } })}
              aria-label={t("table.nextStepDateAriaLabel", { company: vacancy.company })}
              className="bg-surface border border-grid rounded px-1.5 py-1 text-xs w-28 outline-none focus:ring-1 focus:ring-signal/40"
            />
          </label>
          <SimilarVacanciesButton vacancyId={vacancy.id} />
        </div>

        <div className="px-5 py-3 border-b border-surface-2">
          <SkillsInput
            label={t("detail.stackLabel")}
            skills={vacancy.stack}
            onChange={(stack) => updateMutation.mutate({ id: vacancy.id, patch: { stack } })}
            placeholder={t("detail.stackPlaceholder")}
          />
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3">
          <Segmented value={tab} onChange={setTab} options={tabOptions} />
        </div>

        <div className="p-5 flex-1">
          {tab === "overview" && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-ink-dim mb-1">{t("detail.notesLabel")}</div>
                <textarea
                  defaultValue={vacancy.notes}
                  onBlur={(e) => updateMutation.mutate({ id: vacancy.id, patch: { notes: e.target.value } })}
                  placeholder={t("detail.notesPlaceholder")}
                  className="w-full h-24 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-ink-dim mb-1.5">{t("detail.linkedContactsLabel")}</div>
                {linkedContacts.length === 0 ? (
                  <div className="text-xs text-ink-dim">{t("detail.noLinkedContacts")}</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {linkedContacts.map((c) => (
                      <span
                        key={c.id}
                        title={c.role || undefined}
                        className="text-xs px-2 py-1 rounded-lg bg-surface-2 text-ink-dim border border-grid"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "cover" && (
            <div className="space-y-3">
              <Btn size="sm" loading={coverBusy} onClick={genCover}>
                {coverText ? t("detail.regenerate") : t("cv:cvPage.generateLetter")}
              </Btn>
              {coverError && <div className="text-xs text-rose-600">{t("common:errors.generic")}</div>}
              {!coverText && !coverBusy && !coverError && <div className="text-sm text-ink-dim">{t("detail.coverEmptyHint")}</div>}
              {coverText && <Markdown text={coverText} className="text-sm text-ink space-y-2 bg-surface-2 rounded-lg p-3" />}
            </div>
          )}

          {tab === "fit" && (
            <div className="space-y-3">
              <Btn size="sm" loading={matchBusy} onClick={genMatch} disabled={!hasCvText}>
                {match ? t("detail.regenerate") : t("detail.generateFit")}
              </Btn>
              {!hasCvText && <div className="text-xs text-ink-dim">{t("detail.noCvHint")}</div>}
              {!match && !matchBusy && hasCvText && <div className="text-sm text-ink-dim">{t("detail.fitEmptyHint")}</div>}
              {matchBusy && (
                <div className="flex items-center gap-2 text-sm text-ink-dim">
                  <Spinner className="h-3.5 w-3.5" /> {t("common:state.loading")}
                </div>
              )}
              {match && <CvMatchPanel match={match} />}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
