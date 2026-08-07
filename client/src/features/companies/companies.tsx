import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUi } from "../../shared/ui-state";
import { useCompanies, useContacts, useDeleteCompany, useSaveCompany, useUpdateCompany, useVacancies } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, EmptyState, PageHeader, Spinner } from "../../shared/ui";
import { useConfirm } from "../../shared/use-confirm";
import type { Company, Contact, Vacancy } from "../../shared/types";

/* ---------- Company card ---------- */
// Name/notes/questions are edited in a local draft and only sent to the server on an explicit
// Save — the old onBlur-autosave fired every time focus left an input, including on plain
// navigation between fields with no actual change.
function CompanyCard({
  company: c,
  linkedVacancies,
  linkedContacts,
  updateCompanyMutation,
  deleteCompanyMutation,
}: {
  company: Company;
  linkedVacancies: Vacancy[];
  linkedContacts: Contact[];
  updateCompanyMutation: ReturnType<typeof useUpdateCompany>;
  deleteCompanyMutation: ReturnType<typeof useDeleteCompany>;
}) {
  const { t } = useTranslation(["companies", "common"]);
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [rollupOpen, setRollupOpen] = useState(false);
  const [name, setName] = useState(c.name);
  const [website, setWebsite] = useState(c.website);
  const [notes, setNotes] = useState(c.notes);
  const [questions, setQuestions] = useState(c.questions.join("\n"));
  const isSaving = updateCompanyMutation.isPending && updateCompanyMutation.variables?.id === c.id;
  const isDeleting = deleteCompanyMutation.isPending && deleteCompanyMutation.variables === c.id;

  const startEdit = () => {
    setName(c.name);
    setWebsite(c.website);
    setNotes(c.notes);
    setQuestions(c.questions.join("\n"));
    setEditing(true);
  };
  const save = () => {
    if (!name.trim()) return;
    updateCompanyMutation.mutate(
      { id: c.id, patch: { name: name.trim(), website: website.trim(), notes, questions: questions.split("\n").filter(Boolean) } },
      { onSuccess: () => setEditing(false) },
    );
  };
  const del = async () => {
    if (await confirm({ title: t("deleteConfirmTitle", { name: c.name }) })) deleteCompanyMutation.mutate(c.id);
  };

  return (
    <Card>
      <div className="flex items-center gap-1.5 mb-2">
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t("renameAriaLabel", { name: c.name })}
            className="min-w-0 flex-1 bg-surface-2 border border-grid rounded-lg px-2 py-1 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        ) : (
          <div className="font-semibold text-ink">{c.name}</div>
        )}
        {isSaving && (
          <span className="flex items-center gap-1 text-[11px] text-signal">
            <Spinner className="h-3 w-3" /> {t("common:state.saving")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="text-xs text-ink-dim hover:text-signal px-1.5 py-1">
                {t("common:actions.cancel")}
              </button>
              <Btn size="sm" loading={isSaving} disabled={!name.trim()} onClick={save}>
                {t("common:actions.save")}
              </Btn>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
                className="text-xs text-ink-dim hover:text-signal px-1.5 py-1"
                aria-label={t("editAriaLabel", { name: c.name })}
              >
                {t("common:actions.edit")}
              </button>
              <button
                onClick={del}
                disabled={isDeleting}
                className="text-xs text-ink-dim hover:text-rose-600 px-1.5 py-1 disabled:opacity-50"
                aria-label={t("deleteAriaLabel", { name: c.name })}
              >
                {isDeleting ? <Spinner className="h-3 w-3" /> : t("common:actions.delete")}
              </button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            aria-label={t("websiteLabel")}
            placeholder={t("websitePlaceholder")}
            className="w-full mb-2 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label={t("notesAriaLabel", { name: c.name })}
            placeholder={t("notesPlaceholder")}
            className="w-full h-20 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <textarea
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            aria-label={t("questionsAriaLabel", { name: c.name })}
            placeholder={t("questionsPlaceholder")}
            className="w-full h-20 mt-2 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </>
      ) : (
        <>
          {c.website && (
            <a
              href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-ink-dim hover:text-signal hover:underline break-all"
            >
              {c.website}
            </a>
          )}
          {c.notes ? (
            <p className="text-sm text-ink-dim whitespace-pre-wrap">{c.notes}</p>
          ) : (
            <p className="text-sm text-ink-dim/60 italic">{t("notesPlaceholder")}</p>
          )}
          {c.questions.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-0.5">
              {c.questions.map((q, i) => (
                <li key={i} className="text-sm text-ink-dim">
                  {q}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="mt-2 pt-2 border-t border-grid">
        <button
          type="button"
          onClick={() => setRollupOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 text-xs text-ink-dim hover:text-signal"
        >
          <span>
            {t("rollup.vacanciesCount", { count: linkedVacancies.length })} · {t("rollup.contactsCount", { count: linkedContacts.length })}
          </span>
          <span className="ml-auto shrink-0">{rollupOpen ? "▾" : "▸"}</span>
        </button>
        {rollupOpen && (
          <div className="mt-1.5 grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] font-semibold text-ink-dim uppercase tracking-wide mb-1">{t("rollup.vacanciesHeading")}</div>
              {linkedVacancies.length > 0 ? (
                <ul className="space-y-0.5">
                  {linkedVacancies.map((v) => (
                    <li key={v.id} className="text-xs text-ink truncate">
                      {v.position}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-dim/60 italic">{t("rollup.noVacancies")}</p>
              )}
            </div>
            <div>
              <div className="text-[11px] font-semibold text-ink-dim uppercase tracking-wide mb-1">{t("rollup.contactsHeading")}</div>
              {linkedContacts.length > 0 ? (
                <ul className="space-y-0.5">
                  {linkedContacts.map((ct) => (
                    <li key={ct.id} className="text-xs text-ink truncate">
                      {ct.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-dim/60 italic">{t("rollup.noContacts")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- Companies ---------- */
export function Companies() {
  const { t } = useTranslation(["companies", "common"]);
  const { data: companies = [], isLoading } = useCompanies();
  const { data: vacancies = [] } = useVacancies();
  const { data: contacts = [] } = useContacts();
  const saveCompanyMutation = useSaveCompany();
  const updateCompanyMutation = useUpdateCompany();
  const deleteCompanyMutation = useDeleteCompany();
  const [name, setName] = useUi("companies.name", "");
  const isAdding = saveCompanyMutation.isPending;
  const add = () => {
    if (!name) return;
    saveCompanyMutation.mutate({ name, notes: "", questions: [] });
    setName("");
  };
  if (isLoading) return <CardsSkeleton count={2} />;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={t("nameAriaLabel")}
              placeholder={t("namePlaceholder")}
              className="bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
            <Btn loading={isAdding} onClick={add}>
              {t("add")}
            </Btn>
          </div>
        }
      />
      {companies.length === 0 ? (
        <Card>
          <EmptyState title={t("empty.title")} hint={t("empty.hint")} />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {companies.map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              linkedVacancies={vacancies.filter((v) => v.companyId === c.id)}
              linkedContacts={contacts.filter((ct) => ct.companyId === c.id)}
              updateCompanyMutation={updateCompanyMutation}
              deleteCompanyMutation={deleteCompanyMutation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
