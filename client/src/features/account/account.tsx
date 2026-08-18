import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Btn, Card, Chip, PageHeader, ProgressBar, Segmented } from "../../shared/ui";
import { deleteUser } from "../../shared/auth-client";
import { LanguageSwitcher } from "../../shared/language-switcher";
import { ThemeSwitcher } from "../../shared/theme-switcher";
import { DateInput } from "../../shared/date-input";
import {
  useApiTokens,
  useBilling,
  useCreateApiToken,
  useCreateTelegramLinkToken,
  useDigestPreferences,
  useNotificationSettings,
  useOpenBillingPortal,
  useReferralState,
  useRevokeApiToken,
  useSaveNotificationSettings,
  useSetDigestEnabled,
  useTelegramStatus,
  useUnlinkTelegram,
} from "../../shared/queries";
import { useToast } from "../../shared/use-toast";
import { useConfirm } from "../../shared/use-confirm";
import { enableNotifications, disableNotifications, notificationsEnabled, notificationsSupported } from "../../shared/notifications";
import type { ApiToken, ApiTokenCreated, ApiTokenScope } from "../../shared/types";

/** One labeled row inside a grouped settings `Card` — heading/description on the left, the
 * interactive control on the right, wrapping to stack on narrow screens. `children` renders
 * full-width below the row for content that doesn't fit the label/control shape (a referral
 * link input, a quota bar). Rows in the same card are separated by `divide-y` on the parent. */
function SettingRow({
  heading,
  description,
  control,
  children,
}: {
  heading: string;
  description?: string;
  control?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">{heading}</div>
          {description && <p className="text-xs text-ink-dim mt-0.5 max-w-md">{description}</p>}
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      {children && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

function GroupCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <div className="text-sm font-semibold text-ink mb-1">{title}</div>
      <div className="divide-y divide-grid">{children}</div>
    </Card>
  );
}

export function Account() {
  const { t } = useTranslation(["account", "billing", "common"]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: digestPrefs } = useDigestPreferences();
  const setDigestEnabledMutation = useSetDigestEnabled();
  const { data: billing } = useBilling();
  const openPortal = useOpenBillingPortal();
  const { data: telegramStatus } = useTelegramStatus();
  const createTelegramLinkToken = useCreateTelegramLinkToken();
  const unlinkTelegram = useUnlinkTelegram();
  const { data: notificationSettings } = useNotificationSettings();
  const saveNotificationSettings = useSaveNotificationSettings();
  const { data: referral } = useReferralState();
  const { data: apiTokens } = useApiTokens();
  const createApiToken = useCreateApiToken();
  const revokeApiToken = useRevokeApiToken();
  const [notifOn, setNotifOn] = useState(() => notificationsEnabled());
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [newTokenLabel, setNewTokenLabel] = useState("");
  const [newTokenScope, setNewTokenScope] = useState<ApiTokenScope>("read");
  const [newTokenExpiry, setNewTokenExpiry] = useState("");
  // The raw token value, readable exactly once right after creation — deliberately local state,
  // never written to the query cache (GET /mcp/tokens can never return it again). Cleared by
  // unmounting (navigating away), the reveal panel's own "Done" button, or a fresh creation.
  const [createdToken, setCreatedToken] = useState<ApiTokenCreated | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  async function onCopyReferralLink() {
    if (!referral) return;
    await navigator.clipboard.writeText(`${window.location.origin}/register?ref=${referral.code}`);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  }

  async function onCopyApiToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken.token);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  function onCreateApiToken() {
    const label = newTokenLabel.trim();
    if (!label) return;
    createApiToken.mutate(
      { label, scope: newTokenScope, expiresAt: newTokenExpiry || undefined },
      {
        onSuccess: (created) => {
          setCreatedToken(created);
          setNewTokenLabel("");
          setNewTokenScope("read");
          setNewTokenExpiry("");
        },
      },
    );
  }

  async function onRevokeApiToken(token: ApiToken) {
    if (
      await confirm({ title: t("apiTokens.revoke.confirmTitle", { label: token.label }), message: t("apiTokens.revoke.confirmMessage") })
    ) {
      revokeApiToken.mutate(token.id);
    }
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

  function onToggleNotificationKind(kind: string, enabled: boolean) {
    if (!notificationSettings) return;
    // The whole map is sent on every toggle — the endpoint is a PUT that replaces the blob, and
    // only explicit opt-outs are stored, so turning one back ON means dropping its key rather than
    // sending `true` (which would pin it against any future change to the default).
    const next = { ...notificationSettings.prefs };
    if (enabled) delete next[kind];
    else next[kind] = false;
    saveNotificationSettings.mutate(next);
  }

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

      <GroupCard title={t("groups.preferences")}>
        <SettingRow heading={t("language.heading")} description={t("language.description")} control={<LanguageSwitcher />} />
        <SettingRow heading={t("theme.heading")} description={t("theme.description")} control={<ThemeSwitcher />} />
      </GroupCard>

      <GroupCard title={t("groups.notifications")}>
        <SettingRow
          heading={t("notifications.heading")}
          description={t("notifications.description")}
          control={
            !notificationsSupported() ? (
              <span className="text-xs text-ink-dim">{t("notifications.unsupported")}</span>
            ) : notifOn ? (
              <Btn size="sm" variant="ghost" onClick={onDisableNotifications}>
                {t("notifications.disableButton")}
              </Btn>
            ) : (
              <Btn size="sm" onClick={onEnableNotifications}>
                {t("notifications.enableButton")}
              </Btn>
            )
          }
        />
        <SettingRow
          heading={t("digest.heading")}
          description={t("digest.description")}
          control={
            <label className="flex items-center gap-2 text-xs text-ink-dim cursor-pointer">
              <input
                type="checkbox"
                checked={digestPrefs?.enabled ?? false}
                onChange={(e) => setDigestEnabledMutation.mutate(e.target.checked)}
                disabled={setDigestEnabledMutation.isPending}
                className="accent-signal"
              />
              {t("digest.toggleLabel")}
            </label>
          }
        >
          <p className="text-xs text-ink-dim">
            {digestPrefs?.lastSentAt
              ? t("digest.lastSent", { date: new Date(digestPrefs.lastSentAt).toLocaleDateString() })
              : t("digest.neverSent")}
          </p>
        </SettingRow>
        {telegramStatus && (
          <SettingRow
            heading={t("telegram.heading")}
            description={t("telegram.description")}
            control={
              telegramStatus.linked ? (
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
              )
            }
          />
        )}
        {/* Per-event opt-outs only make sense once there's a chat to send to — an unlinked account
            has nothing to switch off, and showing nine dead toggles would just be noise. */}
        {telegramStatus?.linked && notificationSettings && (
          <SettingRow heading={t("telegramEvents.heading")} description={t("telegramEvents.description")}>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {notificationSettings.kinds.map((kind) => (
                <label key={kind} className="flex items-center gap-2 text-xs text-ink-dim cursor-pointer">
                  <input
                    type="checkbox"
                    // Sparse storage: a kind absent from `prefs` is ON. Mirrors the server's
                    // isNotificationEnabled() so the two can't disagree about the default.
                    checked={notificationSettings.prefs[kind] ?? true}
                    onChange={(e) => onToggleNotificationKind(kind, e.target.checked)}
                    disabled={saveNotificationSettings.isPending}
                    className="accent-signal"
                  />
                  {/* The kind is a persisted wire value — only its display label is translated, via
                      a defaultValue fallback so a kind the client doesn't have a string for yet
                      renders as itself instead of a raw i18n key. */}
                  {t(`telegramEvents.kinds.${kind}` as never, { defaultValue: kind })}
                </label>
              ))}
            </div>
          </SettingRow>
        )}
      </GroupCard>

      {/* Only when STRIPE_* is configured server-side — a self-hosted/dev deployment has no
          plan concept at all, so this card doesn't render rather than showing a broken one. */}
      {billing?.billingEnabled && (
        <GroupCard title={t("groups.plan")}>
          <SettingRow
            heading={t("billing:plan.heading")}
            control={
              <Chip tone={billing.plan === "free" ? "slate" : "emerald"}>
                {billing.plan === "free" ? t("billing:plan.free") : t("billing:plan.pro")}
              </Chip>
            }
          >
            <div className="space-y-2">
              {billing.aiCallsPerMonth !== null ? (
                <div className="max-w-xs">
                  <div className="text-xs text-ink-dim mb-1">
                    {t("billing:plan.quotaUsed", { used: billing.aiCallsUsed, limit: billing.aiCallsPerMonth })}
                  </div>
                  <ProgressBar value={billing.aiCallsUsed} max={billing.aiCallsPerMonth} tone="indigo" />
                </div>
              ) : (
                <p className="text-xs text-ink-dim">{t("billing:plan.unlimitedAi")}</p>
              )}
              {billing.currentPeriodEnd && (
                <p className="text-xs text-ink-dim">
                  {billing.cancelAtPeriodEnd
                    ? t("billing:plan.cancelsOn", { date: new Date(billing.currentPeriodEnd).toLocaleDateString() })
                    : t("billing:plan.renewsOn", { date: new Date(billing.currentPeriodEnd).toLocaleDateString() })}
                </p>
              )}
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
          </SettingRow>

          {/* Same gate as the plan row above — the referral bonus only ever raises the Free
              plan's AI-call ceiling, which doesn't exist at all when billing is unconfigured. */}
          {referral && (
            <SettingRow heading={t("referrals.heading")} description={t("referrals.description")}>
              <div className="flex items-center gap-2 flex-wrap mb-2">
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
                <Chip tone={referral.qualified > 0 ? "emerald" : "slate"}>
                  {t("referrals.qualifiedCount", { count: referral.qualified })}
                </Chip>
                {referral.pending > 0 && <span>{t("referrals.pendingCount", { count: referral.pending })}</span>}
                {referral.bonusCallsPerMonth > 0 && <span>{t("referrals.bonusEarned", { count: referral.bonusCallsPerMonth })}</span>}
              </div>
            </SettingRow>
          )}
        </GroupCard>
      )}

      <GroupCard title={t("apiTokens.heading")}>
        <SettingRow heading={t("apiTokens.heading")} description={t("apiTokens.description")} />

        {apiTokens && apiTokens.length > 0 ? (
          <SettingRow heading={t("apiTokens.list.heading")}>
            <div className="space-y-1.5">
              {apiTokens.map((token) => {
                const isRevoking = revokeApiToken.isPending && revokeApiToken.variables === token.id;
                return (
                  <div key={token.id} className="flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg border border-grid flex-wrap">
                    <span className="font-medium text-ink truncate">{token.label}</span>
                    {/* scope is a persisted wire value — only its display label is translated. */}
                    <Chip tone={token.scope === "read_write" ? "amber" : "slate"}>
                      {token.scope === "read_write" ? t("apiTokens.scope.readWrite") : t("apiTokens.scope.read")}
                    </Chip>
                    <span className="text-xs text-ink-dim whitespace-nowrap">
                      {t("apiTokens.list.created", { date: new Date(token.createdAt).toLocaleDateString() })}
                    </span>
                    <span className="text-xs text-ink-dim whitespace-nowrap">
                      {token.lastUsedAt
                        ? t("apiTokens.list.lastUsed", { date: new Date(token.lastUsedAt).toLocaleDateString() })
                        : t("apiTokens.list.neverUsed")}
                    </span>
                    {token.expiresAt && (
                      <span className="text-xs text-ink-dim whitespace-nowrap">
                        {t("apiTokens.list.expires", { date: new Date(token.expiresAt).toLocaleDateString() })}
                      </span>
                    )}
                    <Btn size="sm" variant="ghost" className="ml-auto" loading={isRevoking} onClick={() => onRevokeApiToken(token)}>
                      {t("apiTokens.revoke.button")}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </SettingRow>
        ) : (
          <SettingRow heading={t("apiTokens.list.heading")}>
            <p className="text-xs text-ink-dim">{t("apiTokens.list.empty")}</p>
          </SettingRow>
        )}

        <SettingRow heading={t("apiTokens.create.heading")}>
          {createdToken ? (
            <div className="space-y-2 max-w-md">
              <p className="text-xs text-signal bg-signal/10 border border-signal/30 rounded-lg px-3 py-2">
                {t("apiTokens.reveal.warning")}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  readOnly
                  value={createdToken.token}
                  aria-label={t("apiTokens.reveal.aria")}
                  className="flex-1 min-w-[220px] bg-surface-2 border border-grid rounded-lg px-2 py-1 text-xs font-mono text-ink"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Btn size="sm" variant="ghost" onClick={onCopyApiToken}>
                  {tokenCopied ? t("apiTokens.reveal.copied") : t("apiTokens.reveal.copy")}
                </Btn>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => setCreatedToken(null)}>
                {t("apiTokens.reveal.done")}
              </Btn>
            </div>
          ) : (
            <div className="space-y-2 max-w-md">
              <input
                type="text"
                value={newTokenLabel}
                onChange={(e) => setNewTokenLabel(e.target.value)}
                placeholder={t("apiTokens.create.labelPlaceholder")}
                aria-label={t("apiTokens.create.labelField")}
                className="w-full bg-surface-2 border border-grid rounded-lg px-2 py-1.5 text-sm text-ink"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Segmented
                  value={newTokenScope}
                  onChange={setNewTokenScope}
                  options={[
                    { value: "read", label: t("apiTokens.scope.read") },
                    { value: "read_write", label: t("apiTokens.scope.readWrite") },
                  ]}
                />
                <DateInput
                  value={newTokenExpiry}
                  onChange={setNewTokenExpiry}
                  aria-label={t("apiTokens.create.expiresField")}
                  className="w-32 bg-surface-2 border border-grid rounded-lg px-2 py-1.5 text-xs text-ink"
                />
                <Btn size="sm" loading={createApiToken.isPending} disabled={!newTokenLabel.trim()} onClick={onCreateApiToken}>
                  {t("apiTokens.create.button")}
                </Btn>
              </div>
            </div>
          )}
        </SettingRow>
      </GroupCard>

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
