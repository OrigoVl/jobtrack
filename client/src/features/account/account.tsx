import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Card, PageHeader } from "../../shared/ui";
import { deleteUser } from "../../shared/auth-client";
import { LanguageSwitcher } from "../../shared/language-switcher";
import { ThemeSwitcher } from "../../shared/theme-switcher";
import { useDigestPreferences, useSetDigestEnabled } from "../../shared/queries";

export function Account() {
  const { t } = useTranslation(["account", "common"]);
  const { data: digestPrefs } = useDigestPreferences();
  const setDigestEnabledMutation = useSetDigestEnabled();
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRequestDelete() {
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await deleteUser({ callbackURL: "/login?deleted=1" });
    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message || t("deleteAccount.genericError"));
      return;
    }
    setDeleteRequested(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card>
        <div className="text-sm font-semibold text-ink">Language</div>
        <p className="text-xs text-ink-dim mt-1 mb-3 max-w-2xl">Changes the app's language everywhere, including AI-generated advice.</p>
        <LanguageSwitcher />
      </Card>

      <Card>
        <div className="text-sm font-semibold text-ink">{t("theme.heading")}</div>
        <p className="text-xs text-ink-dim mt-1 mb-3 max-w-2xl">{t("theme.description")}</p>
        <ThemeSwitcher />
      </Card>

      <Card>
        <div className="text-sm font-semibold text-ink">{t("digest.heading")}</div>
        <p className="text-xs text-ink-dim mt-1 mb-3 max-w-2xl">{t("digest.description")}</p>
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={digestPrefs?.enabled ?? false}
            onChange={(e) => setDigestEnabledMutation.mutate(e.target.checked)}
            disabled={setDigestEnabledMutation.isPending}
            className="accent-signal"
          />
          {t("digest.toggleLabel")}
        </label>
        <p className="text-xs text-ink-dim mt-2">
          {digestPrefs?.lastSentAt
            ? t("digest.lastSent", { date: new Date(digestPrefs.lastSentAt).toLocaleDateString() })
            : t("digest.neverSent")}
        </p>
      </Card>

      <Card>
        <div className="text-sm font-semibold text-ink">{t("export.heading")}</div>
        <p className="text-xs text-ink-dim mt-1 mb-3 max-w-2xl">{t("export.description")}</p>
        {/* A plain download link, not a fetch()+blob dance — the server already sets
            Content-Disposition: attachment, so a direct navigation triggers the browser's
            native download with the right filename. */}
        <Btn size="sm" onClick={() => (window.location.href = "/api/account/export")}>
          {t("export.button")}
        </Btn>
      </Card>

      <Card className="border-rose-200 dark:border-rose-800">
        <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">{t("deleteAccount.heading")}</div>
        <p className="text-xs text-ink-dim mt-1 mb-3 max-w-2xl">{t("deleteAccount.description")}</p>
        {deleteRequested ? (
          <p className="text-sm text-signal bg-signal/10 border border-signal/30 rounded-lg px-3 py-2">
            {t("deleteAccount.confirmationSent")}
          </p>
        ) : (
          <>
            {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}
            <Btn variant="danger" size="sm" loading={deleting} onClick={onRequestDelete}>
              {t("deleteAccount.button")}
            </Btn>
          </>
        )}
      </Card>
    </div>
  );
}
