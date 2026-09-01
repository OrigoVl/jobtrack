import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useAddVacancy, useEnrichCompany } from "../../shared/queries";
import { Btn, Select } from "../../shared/ui";
import { SkillsInput } from "../../shared/view-kit";
import { STATUSES, type Vacancy } from "../../shared/types";
import { statusLabel } from "../../shared/status-labels";
import { looksNonTechnical } from "../../shared/tracks";

/**
 * A dedicated "new vacancy" form — unlike VacancyDetailModal (which edits an already-persisted
 * row, auto-saving each field on blur/change), nothing here is sent to the server until Save is
 * clicked. "Add vacancy" used to POST immediately with placeholder text ("New company"/
 * "Position") that had to be erased before typing the real values, and any URL typed while
 * editing the resulting (already-created) row silently triggered the server's URL auto-enrichment
 * — both surprising. Real placeholders + an explicit Save fixes both: the vacancy only exists
 * once the user deliberately commits it, and auto-enrichment (if a URL was filled in) still runs,
 * but as a direct result of that same Save action instead of behind the user's back mid-edit.
 */
export function VacancyCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (vacancy: Vacancy) => void }) {
  const { t } = useTranslation(["vacancies", "common"]);
  const addVacancyMutation = useAddVacancy();
  const enrichCompanyMutation = useEnrichCompany();
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [url, setUrl] = useState("");
  const [level, setLevel] = useState("");
  const [salary, setSalary] = useState("");
  const [status, setStatus] = useState<string>(STATUSES[0]);
  const [stack, setStack] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  // Hides the Tech stack input for a position that plainly isn't technical (PM/QA/Design — see
  // tracks.ts's looksNonTechnical), per explicit product decision. Never hides once stack already
  // has entries (e.g. from autofill before the position was edited into a non-technical one) —
  // this is about not showing an irrelevant empty field, not about hiding real data — and a
  // manual override always wins so a heuristic miss never actually blocks anyone.
  const [stackForced, setStackForced] = useState(false);
  const showStack = stackForced || stack.length > 0 || !looksNonTechnical(position);
  const [autofillBusy, setAutofillBusy] = useState(false);
  const [autofillEmpty, setAutofillEmpty] = useState(false);
  // What autofill read about the EMPLOYER (as opposed to the role), held until Save so nothing is
  // written for a modal the user ends up cancelling. Null until an autofill actually produced a
  // company name — the company row is created either way (see save()), this only enriches it.
  const [companyEnrichment, setCompanyEnrichment] = useState<{ notes: string; website: string; questions: string[] } | null>(null);

  // The same "any public link → company/position/stack" smart-fill the bulk "Import" textarea
  // already does for multiple links at once (see vacancy-analysis.service.ts's
  // fetchVacancyDetails) — moved here too since adding ONE vacancy from ONE link is really just
  // "adding a vacancy", not "importing". Explicit button, not automatic on blur/paste: an earlier
  // version of this modal auto-triggered enrichment as a side effect of saving, which surprised
  // users with fields (esp. the stack) that filled in without an action they took themselves.
  const autofill = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setAutofillBusy(true);
    setAutofillEmpty(false);
    try {
      const details = await api.fetchVacancyDetails(trimmed);
      if (details.company) setCompany((cur) => cur || details.company);
      if (details.position) setPosition((cur) => cur || details.position);
      if (details.level) setLevel((cur) => cur || details.level);
      if (details.salary) setSalary((cur) => cur || details.salary);
      if (details.notes) setNotes((cur) => cur || details.notes);
      if (details.stack.length) {
        setStack((cur) => {
          const seen = new Set(cur.map((s) => s.toLowerCase()));
          return [...cur, ...details.stack.filter((s) => !seen.has(s.toLowerCase()))];
        });
      }
      // Offline (no LLM key) these three are empty while company/position/stack still fill in —
      // the checkbox then just creates a bare company row, which is still worth offering.
      if (details.company) {
        setCompanyEnrichment({
          notes: details.companyNotes,
          website: details.companyWebsite,
          questions: details.companyQuestions,
        });
      }
      if (!details.company && !details.position && details.stack.length === 0) setAutofillEmpty(true);
    } catch {
      setAutofillEmpty(true);
    } finally {
      setAutofillBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // The company row is created BEFORE the vacancy, so its id can go straight into the insert —
  // one round trip fewer than creating the vacancy and patching `companyId` onto it afterwards.
  // A failure here must not cost the user the vacancy they were saving: the mutation's own error
  // toast has already fired, and we fall through and save the vacancy unlinked.
  //
  // Any typed name creates/links a company, not just one an autofill produced: the detail modal
  // no longer has a free-text company field, so this is the only place the link gets established.
  // enrichCompany upserts by name and only fills blanks, so re-adding a vacancy for a company that
  // already exists links to it instead of duplicating or overwriting it.
  const canSave = company.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    let companyId: number | undefined;
    const name = company.trim();
    if (name) {
      try {
        const row = await enrichCompanyMutation.mutateAsync({ name, ...(companyEnrichment ?? {}) });
        if (row.id) companyId = row.id;
      } catch {
        /* saved unlinked — see above */
      }
    }
    addVacancyMutation.mutate(
      { company, position, url, level, salary, status, stack, notes, ...(companyId ? { companyId } : {}) },
      { onSuccess: (row) => onCreated(row) },
    );
  };

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-ink/45 backdrop-blur-sm p-3 md:p-6" onClick={onClose}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("create.heading")}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl bg-surface border border-grid shadow-lg flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-surface-2">
          <div className="font-display text-lg font-bold text-ink">{t("create.heading")}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common:actions.close")}
            className="shrink-0 text-ink-dim hover:text-ink text-lg leading-none p-1 -m-1 rounded-lg hover:bg-surface-2"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-ink-dim">{t("detail.companyAriaLabel")}</div>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t("create.companyPlaceholder")}
                aria-label={t("detail.companyAriaLabel")}
                className="w-full bg-surface-2 border border-grid rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs font-semibold text-ink-dim">{t("detail.positionAriaLabel")}</div>
              <input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder={t("create.positionPlaceholder")}
                aria-label={t("detail.positionAriaLabel")}
                className="w-full bg-surface-2 border border-grid rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <div className="text-xs font-semibold text-ink-dim">{t("create.urlLabel")}</div>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setAutofillEmpty(false);
                }}
                placeholder={t("table.vacancyLinkPlaceholder")}
                aria-label={t("table.vacancyLinkAriaLabel", { company })}
                className="flex-1 min-w-0 bg-surface-2 border border-grid rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
              />
              <Btn
                type="button"
                size="sm"
                variant="ghost"
                onClick={autofill}
                loading={autofillBusy}
                disabled={!url.trim()}
                className="shrink-0"
              >
                {t("create.autofillButton")}
              </Btn>
            </div>
            {autofillEmpty && <div className="text-[11px] text-ink-dim">{t("create.autofillEmpty")}</div>}
          </label>

          {company.trim() && (
            <div className="text-xs text-ink-dim">
              {t("create.createCompanyNote", { company: company.trim() })}
              {companyEnrichment?.notes && <span className="block text-[11px] opacity-70">{t("create.createCompanyHint")}</span>}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-ink-dim">{t("table.status")}</div>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1">
              <div className="text-xs font-semibold text-ink-dim">{t("detail.levelAriaLabel")}</div>
              <input
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder={t("create.levelPlaceholder")}
                aria-label={t("detail.levelAriaLabel")}
                className="w-full bg-surface-2 border border-grid rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs font-semibold text-ink-dim">{t("table.salary")}</div>
              <input
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder={t("table.salaryPlaceholder")}
                aria-label={t("table.salaryAriaLabel", { company })}
                className="w-full bg-surface-2 border border-grid rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
              />
            </label>
          </div>

          <div>
            {showStack ? (
              <SkillsInput
                label={t("detail.stackLabel")}
                skills={stack}
                onChange={setStack}
                placeholder={url ? t("create.stackPlaceholderWithUrl") : t("detail.stackPlaceholder")}
              />
            ) : (
              <button type="button" onClick={() => setStackForced(true)} className="text-xs text-ink-dim hover:text-signal hover:underline">
                {t("create.showStackAnyway")}
              </button>
            )}
          </div>

          <label className="space-y-1 block">
            <div className="text-xs font-semibold text-ink-dim">{t("detail.notesLabel")}</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={notes ? 8 : 3}
              placeholder={t("detail.notesPlaceholder")}
              aria-label={t("detail.notesLabel")}
              className="w-full bg-surface-2 border border-grid rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-surface-2">
          <Btn variant="ghost" onClick={onClose} disabled={addVacancyMutation.isPending || enrichCompanyMutation.isPending}>
            {t("common:actions.cancel")}
          </Btn>
          <Btn onClick={save} disabled={!canSave} loading={addVacancyMutation.isPending || enrichCompanyMutation.isPending}>
            {t("common:actions.save")}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
