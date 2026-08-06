import { useTranslation } from "react-i18next";
import { Btn, Card, Chip, PageHeader } from "../../shared/ui";
import { useBilling, useOpenBillingPortal, useStartCheckout } from "../../shared/queries";

export function Pricing() {
  const { t } = useTranslation(["billing", "common"]);
  const { data: billing, isLoading } = useBilling();
  const startCheckout = useStartCheckout();
  const openPortal = useOpenBillingPortal();

  if (isLoading) return null;

  // Every dev machine, all of e2e, and every self-hoster leave STRIPE_* unset — billing.isAvailable
  // is false there, and this page has nothing useful to sell. Shown instead of the pricing cards
  // so a self-hosted deployment doesn't present a broken "Upgrade" button that 503s.
  if (!billing?.billingEnabled) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
        <Card>
          <p className="text-sm text-ink-dim">{t("notConfigured")}</p>
        </Card>
      </div>
    );
  }

  const isPro = billing.plan === "pro" || billing.plan === "team";

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-ink">{t("free.name")}</div>
            {billing.plan === "free" && <Chip tone="slate">{t("currentPlan")}</Chip>}
          </div>
          <div className="text-2xl font-display font-bold text-ink mb-3">{t("free.price")}</div>
          <ul className="space-y-1.5 text-sm text-ink-dim">
            {(t("free.features", { returnObjects: true }) as string[]).map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        </Card>

        <Card className="border-signal/40">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-ink">{t("pro.name")}</div>
            {isPro && <Chip tone="emerald">{t("currentPlan")}</Chip>}
          </div>
          <div className="text-2xl font-display font-bold text-ink mb-3">{t("pro.price")}</div>
          <ul className="space-y-1.5 text-sm text-ink-dim mb-4">
            {(t("pro.features", { returnObjects: true }) as string[]).map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
          {isPro ? (
            <Btn size="sm" variant="ghost" loading={openPortal.isPending} onClick={() => openPortal.mutate()}>
              {t("manageBillingButton")}
            </Btn>
          ) : (
            <Btn size="sm" loading={startCheckout.isPending} onClick={() => startCheckout.mutate("pro")}>
              {t("upgradeButton")}
            </Btn>
          )}
        </Card>
      </div>
    </div>
  );
}
