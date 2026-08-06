import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Btn, Card, Chip, PageHeader, ProgressBar } from "../../shared/ui";
import { deleteUser } from "../../shared/auth-client";
import { LanguageSwitcher } from "../../shared/language-switcher";
import { ThemeSwitcher } from "../../shared/theme-switcher";
import {
  useBilling,
  useCreateTelegramLinkToken,
  useDigestPreferences,
  useOpenBillingPortal,
  useReferralState,
  useSetDigestEnabled,
  useTelegramStatus,
  useUnlinkTelegram,
} from "../../shared/queries";
import { useToast } from "../../shared/use-toast";
import { enableNotifications, disableNotifications, notificationsEnabled, notificationsSupported } from "../../shared/notifications";

export function Account() {
  const { t } = useTranslation(["account", "billing", "common"]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: digestPrefs } = useDigestPreferences();
  const setDigestEnabledMutation = useSetDigestEnabled();
  const { data: billing } = useBilling();
  const openPortal = useOpenBillingPortal();
  const { data: telegramStatus } = useTelegramStatus();
  const createTelegramLinkToken = useCreateTelegramLinkToken();
  const unlinkTelegram = useUnlinkTelegram();
  const { data: referral } = useReferralState();
  const [notifOn, setNotifOn] = useState(() => notificationsEnabled());
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);

  async function onCopyReferralLink() {
    if (!referral) return;
    await navigator.clipboard.writeText(`${window.location.origin}/register?ref=${referral.code}`);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  }

  const onEnableNotifications = async () => {
    const ok = await enableNotifications();
    setNotifOn(ok);
    toast(ok ? t("notifications.enabledToast") : t("notifications.deniedToast"), ok ? "success" : "error");
  };
  const onDisableNotifications = () => {
    disableNotifications();
    setNotifOn(false);
    toast(t("notifications.disabledToast"), "success");
  };

  async function onLinkTelegram() {
    const { deepLink } = await createTelegramLinkToken.mutateAsync();
    // A real page navigation (not window.open) — same convention as the billing checkout/portal
    // redirects, and avoids popup-blocker interference since this runs after an awaited mutation,
    // not perfectly synchronously with the click. t.me deep links hand off to the Telegram app
    // (mobile) or web client, then the user comes back here manually once linked.
    window.location.href = deepLink;
  }

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
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

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
        <div className="text-sm font-semibold text-ink">{t("notifications.heading")}</div>
        <p className="text-xs text-ink-dim mt-1 mb-3 max-w-2xl">{t("notifications.description")}</p>
        {!notificationsSupported() ? (
          <p className="text-xs text-ink-dim">{t("notifications.unsupported")}</p>
        ) : notifOn ? (
          <Btn size="sm" variant="ghost" onClick={onDisableNotifications}>
            {t("notifications.disableButton")}
          </Btn>
        ) : (
          <Btn size="sm" onClick={onEnableNotifications}>
            {t("notifications.enableButton")}
          </Btn>
        )}
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

      {telegramStatus && (
        <Card>
          <div className="text-sm font-semibold text-ink">{t("telegram.heading")}</div>
          <p className="text-xs text-ink-dim mt-1 mb-3 max-w-2xl">{t("telegram.description")}</p>
          {telegramStatus.linked ? (
            <div className="flex items-center gap-2">
              <Chip tone="emerald">{t("telegram.linkedBadge")}</Chip>
              <Btn size="sm" variant="ghost" loading={unlinkTelegram.isPending} onClick={() => unlinkTelegram.mutate()}>
                {t("telegram.unlinkButton")}
              </Btn>
            </div>
          ) : (
            <Btn size="sm" loading={createTelegramLinkToken.isPending} onClick={onLinkTelegram}>
              {t("telegram.linkButton")}
            </Btn>
          )}
        </Card>
      )}

      {/* Only when STRIPE_* is configured server-side — a self-hosted/dev deployment has no
          plan concept at all, so this card doesn't render rather than showing a broken one. */}
      {billing?.billingEnabled && (
        <Card>
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-semibold text-ink">{t("billing:plan.heading")}</div>
            <Chip tone={billing.plan === "free" ? "slate" : "emerald"}>
              {billing.plan === "free" ? t("billing:plan.free") : t("billing:plan.pro")}
            </Chip>
          </div>
          {billing.aiCallsPerMonth !== null ? (
            <div className="mt-2 max-w-xs">
              <div className="text-xs text-ink-dim mb-1">
                {t("billing:plan.quotaUsed", { used: billing.aiCallsUsed, limit: billing.aiCallsPerMonth })}
              </div>
              <ProgressBar value={billing.aiCallsUsed} max={billing.aiCallsPerMonth} tone="indigo" />
            </div>
          ) : (
            <p className="text-xs text-ink-dim mt-1">{t("billing:plan.unlimitedAi")}</p>
          )}
          {billing.currentPeriodEnd && (
            <p className="text-xs text-ink-dim mt-2">
              {billing.cancelAtPeriodEnd
                ? t("billing:plan.cancelsOn", { date: new Date(billing.currentPeriodEnd).toLocaleDateString() })
                : t("billing:plan.renewsOn", { date: new Date(billing.currentPeriodEnd).toLocaleDateString() })}
            </p>
          )}
          <div className="mt-3">
            {billing.plan === "free" ? (
              <Btn size="sm" onClick={() => navigate("/pricing")}>
                {t("billing:upgradeButton")}
              </Btn>
            ) : (
              <Btn size="sm" variant="ghost" loading={openPortal.isPending} onClick={() => openPortal.mutate()}>
                {t("billing:manageBillingButton")}
              </Btn>
            )}
          </div>
        </Card>
      )}

      {/* Same gate as the plan card above — the referral bonus only ever raises the Free
          plan's AI-call ceiling, which doesn't exist at all when billing is unconfigured. */}
      {referral && billing?.billingEnabled && (
        <Card>
          <div className="text-sm font-semibold text-ink">{t("referrals.heading")}</div>
          <p className="text-xs text-ink-dim mt-1 mb-3 max-w-2xl">{t("referrals.description")}</p>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <input
              readOnly
              value={`${window.location.origin}/register?ref=${referral.code}`}
              aria-label={t("referrals.linkAria")}
              className="flex-1 min-w-[220px] bg-surface-2 border border-grid rounded-lg px-2 py-1 text-xs font-mono text-ink"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Btn size="sm" variant="ghost" onClick={onCopyReferralLink}>
              {referralCopied ? t("referrals.copied") : t("referrals.copy")}
            </Btn>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-ink-dim">
            <Chip tone={referral.qualified > 0 ? "emerald" : "slate"}>{t("referrals.qualifiedCount", { count: referral.qualified })}</Chip>
            {referral.pending > 0 && <span>{t("referrals.pendingCount", { count: referral.pending })}</span>}
            {referral.bonusCallsPerMonth > 0 && <span>{t("referrals.bonusEarned", { count: referral.bonusCallsPerMonth })}</span>}
          </div>
        </Card>
      )}

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
