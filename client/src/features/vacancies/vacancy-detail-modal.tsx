import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import {
  useAddContact,
  useCompanies,
  useContacts,
  useEnrichCompany,
  useProfile,
  useSaveCompany,
  useUpdateContact,
  useUpdateVacancy,
} from "../../shared/queries";
import { useToast } from "../../shared/use-toast";
import { Btn, SearchSelect, Segmented, Spinner } from "../../shared/ui";
import { StarIcon } from "../../shared/icons";
import { useConfirm } from "../../shared/use-confirm";
import { SkillsInput } from "../../shared/view-kit";
import { STATUSES, type CvMatch, type Fit, type Vacancy, type VacancyStatus } from "../../shared/types";
import { fitLabel, fitText } from "../../shared/fit-tone";
import { statusLabel } from "../../shared/status-labels";
import { STATUS_SELECT_CLASS, DEFAULT_STATUS_SELECT_CLASS } from "../../shared/status-tone";
import { DateInput } from "../../shared/date-input";
import { SimilarVacanciesButton } from "./similar-vacancies-button";
import { CvMatchPanel } from "../cv/cv";
import { PostingContactsFinder } from "../contacts/posting-contacts";
import { contactsAtCompany } from "../contacts/contacts-at-company";

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
 * The fields this modal edits as a LOCAL draft, committed only when the user presses Save.
 *
 * What stays outside it — status, fit, the two dates, the star, and the contact controls — are
 * one-gesture state changes with no half-finished form to lose, and the status/date ones are the
 * same controls the table row commits on the spot; an explicit Save there would only add a step.
 * Everything a user builds up piece by piece is in the draft: free text (the old per-field onBlur
 * autosave fired on any focus change and felt like it saved on every click — the same complaint
 * that moved the Companies page to an explicit draft, commit b415fab), the tech stack, and the
 * linked-company select. The last two are "picks" but still belong here: adding four skills or
 * re-pointing the company and then hitting Cancel has to actually undo all of it.
 */
type VacancyDraft = Pick<
  Vacancy,
  "position" | "url" | "level" | "salary" | "notes" | "coverLetterDetails" | "coverLetter" | "company" | "companyId" | "stack"
>;

const DRAFT_FIELDS = [
  "position",
  "url",
  "level",
  "salary",
  "notes",
  "coverLetterDetails",
  "coverLetter",
  "company",
  "companyId",
  "stack",
] as const;

const draftOf = (v: Vacancy): VacancyDraft => ({
  position: v.position,
  url: v.url,
  level: v.level,
  salary: v.salary,
  notes: v.notes,
  coverLetterDetails: v.coverLetterDetails,
  coverLetter: v.coverLetter,
  // The company pair travels together: picking one in the select sets both, so the vacancy's own
  // `company` string can never name a different row than `companyId` points at.
  company: v.company,
  companyId: v.companyId,
  stack: v.stack,
});

/** Field-wise equality for the dirty check. `stack` is an array, so a plain !== would call the
 * draft dirty the moment any refetch handed us a new (equal) array instance. */
const sameFieldValue = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => v === b[i]) : a === b;

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
  const { t, i18n } = useTranslation(["vacancies", "cv", "common"]);
  const { toast } = useToast();
  const { data: profile } = useProfile();
  const { data: contacts = [] } = useContacts();
  const { data: companies = [] } = useCompanies();
  const updateMutation = useUpdateVacancy();
  const saveCompanyMutation = useSaveCompany();
  const enrichCompanyMutation = useEnrichCompany();
  const linkContactMutation = useUpdateContact();
  const addContactMutation = useAddContact();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>(initialTab);

  // Seeded once, on mount: this modal is remounted per vacancy (the table/Kanban render it only
  // for the open row), so there's no "the prop changed under us" case to re-sync from — and not
  // re-seeding is what keeps a Save-pending edit from being wiped by an unrelated refetch.
  const [draft, setDraft] = useState<VacancyDraft>(() => draftOf(vacancy));
  const [saving, setSaving] = useState(false);
  const dirty = DRAFT_FIELDS.some((f) => !sameFieldValue(draft[f], vacancy[f]));
  const patchDraft = (patch: Partial<VacancyDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [coverCopied, setCoverCopied] = useState(false);
  const [match, setMatch] = useState<CvMatch | null>(null);
  const [matchBusy, setMatchBusy] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [refreshBusy, setRefreshBusy] = useState(false);
  // POST /companies upserts by name rather than returning the created/existing row's id (see
  // useSaveCompany), so the "create company from this vacancy" quick-create can't get the new id
  // straight out of the mutation result — it flags this instead, and the effect below picks the
  // now-invalidated+refetched `companies` list back up once the matching name appears in it.
  const [pendingCompanyLink, setPendingCompanyLink] = useState(false);

  useEffect(() => {
    if (!pendingCompanyLink) return;
    const created = companies.find((c) => c.name === draft.company);
    if (created) {
      setPendingCompanyLink(false);
      // The company row itself is created for real; only the vacancy's link to it is a draft edit.
      patchDraft({ companyId: created.id });
    }
  }, [pendingCompanyLink, companies, draft.company]);

  const save = () => {
    if (!dirty) {
      onClose();
      return;
    }
    setSaving(true);
    updateMutation.mutate({ id: vacancy.id, patch: draft }, { onSuccess: () => onClose(), onError: () => setSaving(false) });
  };

  /** Closing with a pending draft asks first — every other route out of this modal (Escape, the ✕,
   * the backdrop, Cancel) goes through here, so there's no way to lose typed text by accident. */
  const requestClose = async () => {
    const confirmed =
      !dirty ||
      (await confirm({
        title: t("detail.discardConfirmTitle"),
        message: t("detail.discardConfirmMessage"),
        confirmLabel: t("detail.discardConfirmAction"),
      }));
    if (!confirmed) return;
    onClose();
  };

  // Escape closes, same convention as the confirm dialog / every other overlay in this app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") void requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, dirty]);

  // Built from the draft, not the saved row: the LLM prompts below must describe the vacancy the
  // user is looking at, including edits not yet committed.
  const jobText = vacancyJobText({ ...vacancy, ...draft });
  const linkedContacts = contacts.filter((c) => c.vacancyId === vacancy.id);
  const unlinkedContacts = contacts.filter((c) => c.vacancyId == null);
  // People already in the user's own network at this employer — the warmest route into a company,
  // and until now it was buried in the link picker's alphabetical list. Uses the SAVED vacancy,
  // not the draft: an uncommitted company edit shouldn't retarget who "already knows" whom.
  const knownAtCompany = contactsAtCompany(contacts, vacancy, companies);
  const hasCvText = !!profile?.cvText?.trim();

  // Generating/clearing the letter writes into the draft like any other edit to that textarea —
  // the LLM call itself runs immediately, but Save is still what persists its result, so Cancel
  // undoes a generation the user didn't want.
  const genCover = async () => {
    setCoverBusy(true);
    setCoverError(false);
    try {
      const { text } = await api.coverLetter(jobText, draft.company, draft.coverLetterDetails);
      patchDraft({ coverLetter: text });
    } catch {
      setCoverError(true);
    } finally {
      setCoverBusy(false);
    }
  };
  const clearCover = async () => {
    if (!(await confirm({ title: t("detail.deleteCoverConfirmTitle"), message: t("detail.deleteCoverConfirmMessage") }))) return;
    patchDraft({ coverLetter: "" });
  };
  const genMatch = async () => {
    setMatchBusy(true);
    try {
      setMatch(await api.matchVacancy(profile?.cvText ?? "", draft.position, jobText));
    } finally {
      setMatchBusy(false);
    }
  };

  /**
   * Re-reads the posting behind this vacancy's link and fills in what's still missing — the
   * single-vacancy counterpart of the Analyzer's "re-parse everything" job, which was previously
   * the only way to refresh an already-saved row from its source.
   *
   * Strictly additive: an empty field gets the parsed value, a field the user already filled is
   * left exactly as it is, and the stack is merged rather than replaced. A refresh must never be
   * able to destroy something typed by hand — that's also why the linked company is enriched
   * through api.enrichCompany (which only fills blanks) instead of the overwriting POST /companies.
   * "Already filled" is judged against the DRAFT, not the saved row, so a value the user has just
   * typed but not yet saved is protected too.
   */
  const refreshFromUrl = async () => {
    if (!draft.url) return;
    setRefreshBusy(true);
    try {
      const details = await api.fetchVacancyDetails(draft.url);
      // Everything parsed lands in the draft — a refresh proposes changes, Save is still what
      // commits them, exactly as if they'd been typed or picked by hand.
      const draftPatch: Partial<VacancyDraft> = {};
      if (!draft.position.trim() && details.position) draftPatch.position = details.position;
      if (!draft.level.trim() && details.level) draftPatch.level = details.level;
      if (!draft.salary.trim() && details.salary) draftPatch.salary = details.salary;
      if (!draft.notes.trim() && details.notes) draftPatch.notes = details.notes;
      if (!draft.company.trim() && details.company) draftPatch.company = details.company;

      const known = new Set(draft.stack.map((s) => s.toLowerCase()));
      const newSkills = details.stack.filter((s) => !known.has(s.toLowerCase()));
      if (newSkills.length) draftPatch.stack = [...draft.stack, ...newSkills];

      // The company ROW is created/enriched for real here (that's the point of the refresh) —
      // only the vacancy's link to it waits for Save, like the select does.
      const companyName = (draftPatch.company ?? draft.company).trim();
      if (!draft.companyId && companyName) {
        try {
          const row = await enrichCompanyMutation.mutateAsync({
            name: companyName,
            notes: details.companyNotes,
            website: details.companyWebsite,
            questions: details.companyQuestions,
          });
          if (row.id) draftPatch.companyId = row.id;
        } catch {
          /* the mutation's own error toast already fired — the rest of the refresh still applies */
        }
      }

      if (Object.keys(draftPatch).length === 0) {
        toast(t("detail.refreshNothingNew"), "info");
        return;
      }
      patchDraft(draftPatch);
    } catch {
      toast(t("detail.refreshFailed"), "error");
    } finally {
      setRefreshBusy(false);
    }
  };

  const tabOptions: { value: Tab; label: string }[] = [
    { value: "overview", label: t("detail.tabs.overview") },
    { value: "cover", label: t("detail.tabs.cover") },
    { value: "fit", label: t("detail.tabs.fit") },
  ];

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-ink/50 p-3 md:p-6" onClick={() => void requestClose()}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${vacancy.position || t("detail.untitled")} — ${vacancy.company}`}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl bg-surface border border-grid shadow-lg flex flex-col"
      >
        {/* Header — the text fields are draft state (see VacancyDraft), committed by the footer's
            Save; the star and the linked-company select commit on the spot. */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3 border-b border-surface-2">
          <div className="min-w-0 flex-1 space-y-1">
            <input
              value={draft.position}
              onChange={(e) => patchDraft({ position: e.target.value })}
              placeholder={t("detail.untitled")}
              aria-label={t("detail.positionAriaLabel")}
              className="w-full font-display text-lg font-bold text-ink bg-transparent outline-none focus:ring-1 focus:ring-signal/40 rounded px-1 -mx-1"
            />
            {/* The select IS the company field — no separate name line above it, which only
                repeated whatever it already shows. Free-text editing is gone for good: it used to
                let a vacancy carry a name matching no company (and silently diverge from the
                linked one after a rename). Companies are created up front in VacancyCreateModal,
                and renaming one is the Companies page's job. */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <div className="min-w-0 max-w-[65%]">
                <SearchSelect
                  value={draft.companyId ? String(draft.companyId) : ""}
                  onChange={(value) => {
                    const companyId = value ? Number(value) : null;
                    // Linking also adopts that company's name, so `company` (used by the
                    // cover-letter prompt, the table and every aria-label) can't drift from the
                    // row it points at. Unlinking leaves the name alone — it's the only thing
                    // left identifying the employer.
                    const picked = companyId == null ? undefined : companies.find((c) => c.id === companyId);
                    patchDraft({ companyId, ...(picked ? { company: picked.name } : {}) });
                  }}
                  aria-label={t("detail.companyLinkAriaLabel")}
                  options={[
                    { value: "", label: t("detail.companyLinkNone") },
                    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                  className="w-full !bg-surface-2 !pl-1.5 !py-1 !text-xs !text-ink-dim"
                />
              </div>
              {!draft.companyId && draft.company.trim() && (
                <Btn
                  type="button"
                  size="sm"
                  variant="ghost"
                  loading={saveCompanyMutation.isPending || pendingCompanyLink}
                  onClick={() => {
                    const name = draft.company.trim();
                    if (!name) return;
                    saveCompanyMutation.mutate({ name, notes: "", questions: [] }, { onSuccess: () => setPendingCompanyLink(true) });
                  }}
                  className="shrink-0 !px-2 !py-1 !text-[11px]"
                >
                  {t("detail.createCompanyFromField")}
                </Btn>
              )}
            </div>
            <div className="flex items-center gap-1.5 pt-0.5">
              <input
                type="url"
                value={draft.url}
                onChange={(e) => patchDraft({ url: e.target.value })}
                placeholder={t("table.vacancyLinkPlaceholder")}
                aria-label={t("table.vacancyLinkAriaLabel", { company: vacancy.company })}
                className="flex-1 min-w-0 text-xs text-signal bg-transparent outline-none focus:ring-1 focus:ring-signal/40 rounded px-1 -mx-1"
              />
              {draft.url && (
                <>
                  <Btn
                    type="button"
                    size="sm"
                    variant="ghost"
                    loading={refreshBusy}
                    onClick={refreshFromUrl}
                    title={t("detail.refreshFromUrlHint")}
                    className="shrink-0 !px-2 !py-1 !text-[11px]"
                  >
                    {t("detail.refreshFromUrl")}
                  </Btn>
                  <a
                    href={draft.url}
                    target="_blank"
                    rel="noreferrer"
                    title={t("detail.openOriginal")}
                    aria-label={t("detail.openOriginal")}
                    className="shrink-0 text-signal text-xs hover:opacity-80"
                  >
                    ↗
                  </a>
                </>
              )}
            </div>
            {vacancy.created && (
              <div className="text-[11px] text-ink-dim">
                {t("detail.createdLabel", { date: new Date(vacancy.created).toLocaleDateString(i18n.language) })}
              </div>
            )}
          </div>
          {/* One shared updateMutation backs every immediate field here (status/fit/dates/star) —
              a single indicator covers all of them rather than repeating it per field. The draft's
              own Save has its own spinner, in the footer button. */}
          {updateMutation.isPending && !saving && (
            <div className="shrink-0 flex items-center gap-1 text-[11px] text-signal">
              <Spinner className="h-3 w-3" /> {t("common:state.saving")}
            </div>
          )}
          <button
            type="button"
            onClick={() => updateMutation.mutate({ id: vacancy.id, patch: { favorite: !vacancy.favorite } })}
            title={vacancy.favorite ? t("favorite.removeTitle") : t("favorite.addTitle")}
            aria-label={t(vacancy.favorite ? "favorite.removeAriaLabel" : "favorite.addAriaLabel", { company: vacancy.company })}
            aria-pressed={vacancy.favorite}
            className={`shrink-0 rounded-lg p-1 -m-1 hover:bg-surface-2 ${vacancy.favorite ? "text-amber-400 hover:text-amber-500" : "text-ink-dim hover:text-amber-400"}`}
          >
            <StarIcon className="h-4 w-4" fill={vacancy.favorite ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={() => void requestClose()}
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
            value={draft.level}
            onChange={(e) => patchDraft({ level: e.target.value })}
            placeholder={t("detail.levelPlaceholder")}
            aria-label={t("detail.levelAriaLabel")}
            className="bg-surface border border-grid rounded px-2 py-1 text-xs w-20 outline-none focus:ring-1 focus:ring-signal/40"
          />
          <input
            value={draft.salary}
            onChange={(e) => patchDraft({ salary: e.target.value })}
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
            skills={draft.stack}
            onChange={(stack) => patchDraft({ stack })}
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
                  value={draft.notes}
                  onChange={(e) => patchDraft({ notes: e.target.value })}
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
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="min-w-0 flex-1">
                    {/* Stays on the empty value: this picker is an action ("link this contact"),
                        not a stored field, so it resets to its placeholder after every pick. */}
                    <SearchSelect
                      value=""
                      onChange={(value) => value && linkContactMutation.mutate({ id: Number(value), patch: { vacancyId: vacancy.id } })}
                      disabled={unlinkedContacts.length === 0}
                      aria-label={t("detail.linkContactAriaLabel")}
                      options={[
                        {
                          value: "",
                          label: unlinkedContacts.length === 0 ? t("detail.noUnlinkedContacts") : t("detail.linkContactNone"),
                        },
                        ...unlinkedContacts.map((c) => ({ value: String(c.id), label: c.name })),
                      ]}
                      className="w-full !bg-surface-2 !pl-1.5 !py-1 !text-[11px] !text-ink-dim"
                    />
                  </div>
                  <input
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder={t("detail.newContactPlaceholder")}
                    aria-label={t("detail.newContactPlaceholder")}
                    className="min-w-0 flex-1 bg-surface-2 border border-grid rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-signal/40"
                  />
                  <Btn
                    type="button"
                    size="sm"
                    variant="ghost"
                    loading={addContactMutation.isPending}
                    disabled={!newContactName.trim()}
                    onClick={() => {
                      const name = newContactName.trim();
                      if (!name) return;
                      addContactMutation.mutate({ name, vacancyId: vacancy.id }, { onSuccess: () => setNewContactName("") });
                    }}
                    className="shrink-0 !px-2 !py-1 !text-[11px]"
                  >
                    {t("detail.addContact")}
                  </Btn>
                </div>
                {knownAtCompany.length > 0 && (
                  <div className="mt-2.5">
                    <div className="text-xs font-semibold text-ink-dim mb-1">{t("detail.knownAtCompanyLabel")}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {knownAtCompany.map((c) => {
                        const isLinking = linkContactMutation.isPending && linkContactMutation.variables?.id === c.id;
                        return (
                          <Btn
                            key={c.id}
                            type="button"
                            size="sm"
                            variant="ghost"
                            loading={isLinking}
                            title={t("detail.knownAtCompanyLinkHint")}
                            onClick={() => linkContactMutation.mutate({ id: c.id, patch: { vacancyId: vacancy.id } })}
                            className="!px-2 !py-1 !text-[11px]"
                          >
                            {c.role ? `${c.name} · ${c.role}` : c.name}
                          </Btn>
                        );
                      })}
                    </div>
                  </div>
                )}
                <PostingContactsFinder vacancyId={vacancy.id} companyId={vacancy.companyId ?? null} />
              </div>
            </div>
          )}

          {tab === "cover" && (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-ink-dim mb-1">{t("detail.coverDetailsLabel")}</div>
                <textarea
                  value={draft.coverLetterDetails}
                  onChange={(e) => patchDraft({ coverLetterDetails: e.target.value })}
                  placeholder={t("detail.coverDetailsPlaceholder")}
                  className="w-full h-16 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Btn size="sm" loading={coverBusy} onClick={genCover}>
                  {draft.coverLetter ? t("detail.regenerate") : t("cv:cvPage.generateLetter")}
                </Btn>
                {draft.coverLetter && (
                  <>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await navigator.clipboard.writeText(draft.coverLetter);
                        setCoverCopied(true);
                        setTimeout(() => setCoverCopied(false), 2000);
                      }}
                    >
                      {coverCopied ? t("cv:shared.copied") : t("cv:shared.copy")}
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={clearCover}>
                      {t("common:actions.delete")}
                    </Btn>
                  </>
                )}
              </div>
              {coverError && <div className="text-xs text-rose-600">{t("common:errors.generic")}</div>}
              {!draft.coverLetter && !coverBusy && !coverError && <div className="text-sm text-ink-dim">{t("detail.coverEmptyHint")}</div>}
              {(draft.coverLetter || coverBusy) && (
                <textarea
                  value={draft.coverLetter}
                  onChange={(e) => patchDraft({ coverLetter: e.target.value })}
                  placeholder={t("detail.coverPlaceholder")}
                  className="w-full h-40 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              )}
            </div>
          )}

          {tab === "fit" && (
            <div className="space-y-3">
              {/* No `loading` on the button: the analysis already has its own spinner row below,
                  and two spinners for one request read as two things happening. */}
              <Btn size="sm" onClick={genMatch} disabled={!hasCvText || matchBusy}>
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

        {/* Sticky footer: the draft fields (see VacancyDraft) only reach the server from here.
            It stays visible while the body scrolls, so a long notes/cover-letter edit never
            leaves Save off-screen. */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-surface-2 bg-surface">
          {dirty && <div className="mr-auto text-[11px] text-ink-dim">{t("detail.unsavedChanges")}</div>}
          <Btn variant="ghost" onClick={() => void requestClose()} disabled={saving}>
            {t("common:actions.cancel")}
          </Btn>
          <Btn onClick={save} loading={saving}>
            {t("common:actions.save")}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
