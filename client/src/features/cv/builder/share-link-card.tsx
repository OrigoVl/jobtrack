import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCvShare, useGenerateCvShare, useSetCvShareEnabled } from "../../../shared/queries";
import { Btn, Card } from "../../../shared/ui";

/** Public CV link toggle — generate/enable/disable/copy. Lives on the CV Builder page (not
 * Account) since it's tightly scoped to `cvDoc`, the thing this whole page edits. */
export function ShareLinkCard() {
  const { t } = useTranslation(["cv", "common"]);
  const { data: share, isLoading } = useCvShare();
  const generateMutation = useGenerateCvShare();
  const toggleMutation = useSetCvShareEnabled();
  const [copied, setCopied] = useState(false);

  if (isLoading) return null;

  const url = share ? `${window.location.origin}/cv/public/${share.slug}` : "";
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-ink">{t("shareLink.title")}</div>
          <p className="text-xs text-ink-dim mt-0.5 max-w-md">{t("shareLink.description")}</p>
        </div>
        {!share ? (
          <Btn size="sm" loading={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
            {t("shareLink.create")}
          </Btn>
        ) : (
          <Btn size="sm" variant="ghost" loading={toggleMutation.isPending} onClick={() => toggleMutation.mutate(!share.enabled)}>
            {share.enabled ? t("shareLink.disable") : t("shareLink.reenable")}
          </Btn>
        )}
      </div>
      {share && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <input
            readOnly
            value={url}
            aria-label={t("shareLink.linkAria")}
            className={`flex-1 min-w-[220px] bg-surface-2 border border-grid rounded-lg p-2 text-xs font-mono ${
              share.enabled ? "text-ink" : "text-ink-dim line-through"
            }`}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Btn size="sm" variant="ghost" onClick={copy} disabled={!share.enabled}>
            {copied ? t("shared.copied") : t("shared.copy")}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            loading={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
            title={t("shareLink.regenerateTitle")}
          >
            {t("shareLink.regenerate")}
          </Btn>
        </div>
      )}
    </Card>
  );
}
