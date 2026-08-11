import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAddContact,
  useCompanies,
  useContactOutreach,
  useContacts,
  useDeleteContact,
  useUpdateContact,
  useVacancies,
} from "../../shared/queries";
import { Btn, Card, CardsSkeleton, Chip, EmptyState, PageHeader, SearchSelect, Spinner } from "../../shared/ui";
import { useConfirm } from "../../shared/use-confirm";
import { DateInput } from "../../shared/date-input";
import type { Contact, ContactInput, OutreachResult } from "../../shared/types";
import { SignaturePaste } from "./signature-paste";
import { isStale, silentDays } from "./stale-contacts";

/** Draft an AI outreach/follow-up message for a contact (POST /contacts/:id/outreach) and let the
 * user copy it — mirrors LinkedInOptimizerCard's generate+copy shape, scoped to one contact card
 * instead of a whole page. Each card gets its own mutation instance so drafting for one contact
 * never shows a loading/result state on another. */
function ContactOutreachPanel({ contact }: { contact: Contact }) {
  const { t } = useTranslation(["contacts", "common"]);
  const outreachMutation = useContactOutreach();
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [copied, setCopied] = useState(false);

  const draft = (kind: "intro" | "followup") => {
    setResult(null);
    outreachMutation.mutate({ id: contact.id, kind }, { onSuccess: setResult });
  };
  const isDrafting = (kind: "intro" | "followup") =>
    outreachMutation.isPending && outreachMutation.variables?.id === contact.id && outreachMutation.variables?.kind === kind;
  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2 pt-2 border-t border-grid">
      <div className="flex flex-wrap gap-1.5">
        <Btn size="sm" variant="ghost" loading={isDrafting("intro")} onClick={() => draft("intro")}>
          {t("outreach.draftIntro")}
        </Btn>
        <Btn size="sm" variant="ghost" loading={isDrafting("followup")} onClick={() => draft("followup")}>
          {t("outreach.draftFollowup")}
        </Btn>
      </div>
      {result && (
        <div className="mt-2 space-y-1.5">
          {result.offline && <Chip tone="amber">{t("outreach.offlineNotice")}</Chip>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">{t("outreach.messageLabel")}</span>
            <Btn size="sm" variant="ghost" onClick={copy}>
              {copied ? t("outreach.copied") : t("outreach.copy")}
            </Btn>
          </div>
          <div className="bg-surface-2 border border-grid rounded-lg p-2.5 text-xs text-ink whitespace-pre-wrap">{result.message}</div>
        </div>
      )}
    </div>
  );
}

const EMPTY_DRAFT: ContactInput = {
  name: "",
  role: "",
  companyId: null,
  vacancyId: null,
  email: "",
  linkedinUrl: "",
  notes: "",
  lastContactAt: "",
};

function ContactModal({
  draft,
  editingId,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  draft: ContactInput;
  editingId: number | null;
  onClose: () => void;
  onSave: (draft: ContactInput) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const { t } = useTranslation(["contacts", "common"]);
  const [form, setForm] = useState(draft);
  const { data: companies = [] } = useCompanies();
  const { data: vacancies = [] } = useVacancies();
  const set = <K extends keyof ContactInput>(k: K, v: ContactInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.name.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-label={t("modal.closeAriaLabel")} onClick={onClose} className="fixed inset-0 bg-ink/50 cursor-default" />
      <Card className="relative w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="font-display font-semibold text-ink">{editingId ? t("modal.editTitle") : t("modal.newTitle")}</div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.name")}</span>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("modal.namePlaceholder")}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.role")}</span>
          <input
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            placeholder={t("modal.rolePlaceholder")}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        {/* Both pickers are SearchSelect, not Select: they list rows the user keeps adding
            (companies, vacancies), so they're the case a native <select> stops serving once the
            list is long. Plain <div>, not <label> — see the same note in calendar.tsx. */}
        <div className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.company")}</span>
          <SearchSelect
            value={form.companyId ? String(form.companyId) : ""}
            onChange={(v) => set("companyId", v ? Number(v) : null)}
            aria-label={t("modal.company")}
            options={[{ value: "", label: t("modal.companyNone") }, ...companies.map((c) => ({ value: String(c.id), label: c.name }))]}
            className="w-full mt-0.5 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </div>
        <div className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.vacancy")}</span>
          <SearchSelect
            value={form.vacancyId ? String(form.vacancyId) : ""}
            onChange={(v) => set("vacancyId", v ? Number(v) : null)}
            aria-label={t("modal.vacancy")}
            options={[
              { value: "", label: t("modal.vacancyNone") },
              ...vacancies.map((v) => ({ value: String(v.id), label: `${v.company} — ${v.position || t("modal.vacancyUntitled")}` })),
            ]}
            className="w-full mt-0.5 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">{t("modal.email")}</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">{t("modal.lastContacted")}</span>
            {/* The shared DateInput, not a native `<input type="date">` — `lang="en-US"` isn't
                reliably honored, so a Ukrainian-locale OS rendered this one field as dd.mm.yyyy
                while every other date in the app showed mm/dd/yyyy, and its picker only opened
                from the native icon. Same ISO "yyyy-mm-dd" value shape either way. */}
            <DateInput
              value={form.lastContactAt}
              onChange={(iso) => set("lastContactAt", iso)}
              aria-label={t("modal.lastContacted")}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.linkedinUrl")}</span>
          <input
            type="url"
            value={form.linkedinUrl}
            onChange={(e) => set("linkedinUrl", e.target.value)}
            placeholder="https://www.linkedin.com/in/..."
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.notes")}</span>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder={t("modal.notesPlaceholder")}
            className="w-full h-20 mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <div className="flex items-center gap-2 pt-1">
          {editingId && (
            <Btn variant="danger" size="sm" onClick={onDelete} loading={deleting}>
              {t("common:actions.delete")}
            </Btn>
          )}
          <div className="ml-auto flex gap-2">
            <Btn variant="ghost" size="sm" onClick={onClose}>
              {t("common:actions.cancel")}
            </Btn>
            <Btn size="sm" disabled={!canSave} loading={saving} onClick={() => onSave(form)}>
              {t("common:actions.save")}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function Contacts() {
  const { t } = useTranslation(["contacts", "common"]);
  const confirm = useConfirm();
  const { data: contacts, isLoading } = useContacts();
  const { data: companies = [] } = useCompanies();
  const { data: vacancies = [] } = useVacancies();
  const addMutation = useAddContact();
  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();
  const [modal, setModal] = useState<{ editingId: number | null; draft: ContactInput } | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  // Local calendar day, not UTC: "how long since I wrote" is a question about the user's own
  // calendar, and toISOString() would answer it in a different timezone.
  const todayIso = new Date().toLocaleDateString("en-CA");

  const companyName = (id: number | null) => (id ? (companies.find((c) => c.id === id)?.name ?? "—") : "—");
  const linkedVacancy = (id: number | null) => (id ? vacancies.find((v) => v.id === id) : undefined);

  const openNew = () => setModal({ editingId: null, draft: EMPTY_DRAFT });
  const openEdit = (c: Contact) =>
    setModal({
      editingId: c.id,
      draft: {
        name: c.name,
        role: c.role,
        companyId: c.companyId,
        vacancyId: c.vacancyId,
        email: c.email,
        linkedinUrl: c.linkedinUrl,
        notes: c.notes,
        lastContactAt: c.lastContactAt,
      },
    });

  const save = (draft: ContactInput) => {
    if (modal?.editingId) {
      updateMutation.mutate({ id: modal.editingId, patch: draft }, { onSuccess: () => setModal(null) });
    } else {
      addMutation.mutate(draft, { onSuccess: () => setModal(null) });
    }
  };
  const doDelete = async () => {
    if (!modal?.editingId) return;
    if (!(await confirm({ title: t("deleteConfirmTitle", { name: modal.draft.name || t("common:actions.delete") }) }))) return;
    deleteMutation.mutate(modal.editingId, { onSuccess: () => setModal(null) });
  };

  if (isLoading) return <CardsSkeleton count={2} />;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex items-center gap-1.5">
            <Btn variant="ghost" onClick={() => setSignatureOpen((v) => !v)}>
              {t("signature.toggle")}
            </Btn>
            <Btn onClick={openNew}>{t("addContact")}</Btn>
          </div>
        }
      />

      {signatureOpen && (
        <SignaturePaste
          baseDraft={EMPTY_DRAFT}
          onClose={() => setSignatureOpen(false)}
          onDraft={(draft) => {
            setSignatureOpen(false);
            setModal({ editingId: null, draft });
          }}
        />
      )}

      {!contacts || contacts.length === 0 ? (
        <Card>
          <EmptyState title={t("empty.title")} hint={t("empty.hint")} />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {contacts.map((c) => {
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === c.id;
            return (
              <Card key={c.id}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink truncate">{c.name}</div>
                    <div className="text-xs text-ink-dim truncate">
                      {c.role || "—"}
                      {c.companyId ? ` @ ${companyName(c.companyId)}` : ""}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs text-ink-dim hover:text-signal px-1.5 py-1"
                      aria-label={t("editAriaLabel", { name: c.name })}
                    >
                      {t("common:actions.edit")}
                    </button>
                    <button
                      onClick={async () => {
                        if (await confirm({ title: t("deleteConfirmTitle", { name: c.name }) })) deleteMutation.mutate(c.id);
                      }}
                      disabled={isDeleting}
                      className="text-xs text-ink-dim hover:text-rose-600 px-1.5 py-1 disabled:opacity-50"
                      aria-label={t("deleteAriaLabel", { name: c.name })}
                    >
                      {isDeleting ? <Spinner className="h-3 w-3" /> : t("common:actions.delete")}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {linkedVacancy(c.vacancyId) && (
                    <span className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-dim border border-grid">
                      {linkedVacancy(c.vacancyId)!.company}
                      {linkedVacancy(c.vacancyId)!.position ? ` — ${linkedVacancy(c.vacancyId)!.position}` : ""}
                    </span>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="text-ink-dim hover:text-signal hover:underline">
                      {c.email}
                    </a>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-ink-dim hover:text-signal hover:underline">
                      {t("linkedin")}
                    </a>
                  )}
                  {c.lastContactAt && <span className="text-ink-dim">{t("lastContact", { date: c.lastContactAt })}</span>}
                  {/* A conversation that went quiet. Shown only past the threshold, and never for
                      someone never written to — that's "reach out", a different situation. */}
                  {isStale(c, todayIso) && <Chip tone="rose">{t("stale.silentFor", { count: silentDays(c, todayIso) ?? 0 })}</Chip>}
                  {/* Provenance. Only rendered for a known origin: "" means the row predates the
                      field, and inventing "added by hand" for it would be a fact we don't have. */}
                  {c.source && <span className="text-ink-dim/70">{t(`sourceLabel.${c.source}` as "sourceLabel.manual")}</span>}
                </div>
                {isStale(c, todayIso) && (
                  <div className="mt-2">
                    <Btn
                      size="sm"
                      variant="ghost"
                      loading={updateMutation.isPending && updateMutation.variables?.id === c.id}
                      onClick={() => updateMutation.mutate({ id: c.id, patch: { lastContactAt: todayIso } })}
                    >
                      {t("stale.markContactedToday")}
                    </Btn>
                  </div>
                )}
                {c.notes && <p className="text-xs text-ink-dim mt-2 whitespace-pre-wrap">{c.notes}</p>}
                <ContactOutreachPanel contact={c} />
              </Card>
            );
          })}
        </div>
      )}

      {modal && (
        <ContactModal
          draft={modal.draft}
          editingId={modal.editingId}
          onClose={() => setModal(null)}
          onSave={save}
          onDelete={doDelete}
          saving={addMutation.isPending || updateMutation.isPending}
          deleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
