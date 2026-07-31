import { useState } from "react";
import { Btn, Card, PageHeader } from "../../shared/ui";
import { deleteUser } from "../../shared/auth-client";

export function Account() {
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRequestDelete() {
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await deleteUser({ callbackURL: "/login?deleted=1" });
    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message || "Couldn't start account deletion. Try again.");
      return;
    }
    setDeleteRequested(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Account" subtitle="Export your data, or permanently delete your account." />

      <Card>
        <div className="text-sm font-semibold text-ink">Export your data</div>
        <p className="text-xs text-ink-dim mt-1 mb-3 max-w-2xl">
          Downloads a JSON file with your profile, vacancies, companies, and study progress — everything you've created in DevRadar.
        </p>
        {/* A plain download link, not a fetch()+blob dance — the server already sets
            Content-Disposition: attachment, so a direct navigation triggers the browser's
            native download with the right filename. */}
        <Btn size="sm" onClick={() => (window.location.href = "/api/account/export")}>
          Export my data
        </Btn>
      </Card>

      <Card className="border-rose-200">
        <div className="text-sm font-semibold text-rose-700">Delete your account</div>
        <p className="text-xs text-ink-dim mt-1 mb-3 max-w-2xl">
          Permanently deletes your account and everything in it — vacancies, companies, CV, study progress. This cannot be undone.
        </p>
        {deleteRequested ? (
          <p className="text-sm text-signal bg-signal/10 border border-signal/30 rounded-lg px-3 py-2">
            Check your email — click the link we sent to confirm the deletion. Nothing has been deleted yet.
          </p>
        ) : (
          <>
            {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}
            <Btn variant="danger" size="sm" loading={deleting} onClick={onRequestDelete}>
              Delete my account
            </Btn>
          </>
        )}
      </Card>
    </div>
  );
}
