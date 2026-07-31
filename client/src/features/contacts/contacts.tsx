import { useState } from "react";
import { useAddContact, useCompanies, useContacts, useDeleteContact, useUpdateContact } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, EmptyState, PageHeader, Spinner } from "../../shared/ui";
import type { Contact, ContactInput } from "../../shared/types";

const EMPTY_DRAFT: ContactInput = { name: "", role: "", companyId: null, email: "", linkedinUrl: "", notes: "", lastContactAt: "" };

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
  const [form, setForm] = useState(draft);
  const { data: companies = [] } = useCompanies();
  const set = <K extends keyof ContactInput>(k: K, v: ContactInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.name.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 bg-ink/50 cursor-default" />
      <Card className="relative w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="font-display font-semibold text-ink">{editingId ? "Edit contact" : "New contact"}</div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">Name</span>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Jane Recruiter"
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">Role</span>
          <input
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            placeholder="e.g. Engineering Manager"
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">Company (optional)</span>
          <select
            value={form.companyId ?? ""}
            onChange={(e) => set("companyId", e.target.value ? Number(e.target.value) : null)}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          >
            <option value="">— none —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">Last contacted</span>
            <input
              type="date"
              lang="en-US"
              value={form.lastContactAt}
              onChange={(e) => set("lastContactAt", e.target.value)}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">LinkedIn URL</span>
          <input
            type="url"
            value={form.linkedinUrl}
            onChange={(e) => set("linkedinUrl", e.target.value)}
            placeholder="https://www.linkedin.com/in/..."
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="How you met, what they said, follow-up ideas…"
            className="w-full h-20 mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <div className="flex items-center gap-2 pt-1">
          {editingId && (
            <Btn variant="danger" size="sm" onClick={onDelete} loading={deleting}>
              Delete
            </Btn>
          )}
          <div className="ml-auto flex gap-2">
            <Btn variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Btn>
            <Btn size="sm" disabled={!canSave} loading={saving} onClick={() => onSave(form)}>
              Save
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function Contacts() {
  const { data: contacts, isLoading } = useContacts();
  const { data: companies = [] } = useCompanies();
  const addMutation = useAddContact();
  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();
  const [modal, setModal] = useState<{ editingId: number | null; draft: ContactInput } | null>(null);

  const companyName = (id: number | null) => (id ? (companies.find((c) => c.id === id)?.name ?? "—") : "—");

  const openNew = () => setModal({ editingId: null, draft: EMPTY_DRAFT });
  const openEdit = (c: Contact) =>
    setModal({
      editingId: c.id,
      draft: {
        name: c.name,
        role: c.role,
        companyId: c.companyId,
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
  const doDelete = () => {
    if (!modal?.editingId) return;
    deleteMutation.mutate(modal.editingId, { onSuccess: () => setModal(null) });
  };

  if (isLoading) return <CardsSkeleton count={2} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contacts"
        subtitle="A lightweight networking tracker — recruiters, referrals, people you've met — separate from your Companies notes."
        actions={<Btn onClick={openNew}>+ Add contact</Btn>}
      />

      {!contacts || contacts.length === 0 ? (
        <Card>
          <EmptyState icon="🧑‍🤝‍🧑" title="No contacts yet" hint="Add a recruiter, referral, or anyone worth following up with." />
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
                      aria-label={`Edit ${c.name}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      disabled={isDeleting}
                      className="text-xs text-ink-dim hover:text-rose-600 px-1.5 py-1 disabled:opacity-50"
                      aria-label={`Delete ${c.name}`}
                    >
                      {isDeleting ? <Spinner className="h-3 w-3" /> : "Delete"}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="text-signal hover:underline">
                      {c.email}
                    </a>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-signal hover:underline">
                      LinkedIn ↗
                    </a>
                  )}
                  {c.lastContactAt && <span className="text-ink-dim">Last contact: {c.lastContactAt}</span>}
                </div>
                {c.notes && <p className="text-xs text-ink-dim mt-2 whitespace-pre-wrap">{c.notes}</p>}
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
