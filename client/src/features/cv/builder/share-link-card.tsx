import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCvShare, useGenerateCvShare, useSetCvShareEnabled } from "../../../shared/queries";
import { Btn, Card } from "../../../shared/ui";

/** Public CV link toggle — generate/enable/disable/copy. Lives on the CV Builder page (not
 * Account) since it's tightly scoped to `cvDoc`, the thing this whole page edits. Scoped to the
 * active CV profile tab — each profile has its own independent share link. */
export function ShareLinkCard({ profileId }: { profileId: number }) {
  const { t } = useTranslation(["cv", "common"]);
  const { data: share, isLoading } = useCvShare(profileId);
  const generateMutation = useGenerateCvShare(profileId);
  const toggleMutation = useSetCvShareEnabled(profileId);
  const [copied, setCopied] = useState(false);

  if (isLoading) return null;

  const url = share ? `${window.location.origin}/cv/public/${share.slug}` : "";
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // A single, denser row (title/description as a `title` tooltip instead of a permanent second
  // line) — this card sits above the editor/preview split and is checked far less often than the
  // fields below it, so it shouldn't cost as much of the page's limited above-the-fold height.
  return (
    <Card className="!py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-ink shrink-0" title={t("shareLink.description")}>
          {t("shareLink.title")}
        </span>
        {share && (
          <input
            readOnly
            value={url}
            aria-label={t("shareLink.linkAria")}
            className={`flex-1 min-w-[220px] bg-surface-2 border border-grid rounded-lg px-2 py-1 text-xs font-mono ${
              share.enabled ? "text-ink" : "text-ink-dim line-through"
            }`}
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {share && (
            <>
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
            </>
          )}
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
      </div>
    </Card>
  );
}
