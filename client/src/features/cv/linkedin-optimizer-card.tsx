import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLinkedInOptimize } from "../../shared/queries";
import { Btn, Card, Chip } from "../../shared/ui";
import type { LinkedInOptimizeResult } from "../../shared/types";

/** Copy-to-clipboard button — shows "✓ Copied" for 2s, same pattern as ShareLinkCard's copy button. */
function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation(["cv", "common"]);
  const [copied, setCopied] = useState(false);
  return (
    <Btn
      size="sm"
      variant="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? t("shared.copied") : t("shared.copy")}
    </Btn>
  );
}

/**
 * LinkedIn profile optimizer — generates a headline + About section from the candidate's own
 * profile (POST /cv/linkedin-optimize). No LinkedIn API integration (that needs OAuth/partner
 * approval) — this only produces text the user copies into their own profile themselves.
 */
export function LinkedInOptimizerCard() {
  const { t } = useTranslation(["cv", "common"]);
  const optimizeMutation = useLinkedInOptimize();
  const [result, setResult] = useState<LinkedInOptimizeResult | null>(null);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-ink">{t("linkedin.title")}</div>
          <p className="text-xs text-ink-dim mt-0.5 max-w-md">{t("linkedin.description")}</p>
        </div>
        <Btn size="sm" loading={optimizeMutation.isPending} onClick={() => optimizeMutation.mutate(undefined, { onSuccess: setResult })}>
          {result ? t("linkedin.regenerate") : t("shared.generate")}
        </Btn>
      </div>
      {result && (
        <div className="mt-3 space-y-3">
          {result.offline && <Chip tone="amber">{t("linkedin.offlineNotice")}</Chip>}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">{t("linkedin.headlineLabel")}</span>
              <CopyButton text={result.headline} />
            </div>
            <div className="bg-surface-2 border border-grid rounded-lg p-2.5 text-sm text-ink">{result.headline}</div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">{t("linkedin.aboutLabel")}</span>
              <CopyButton text={result.about} />
            </div>
            <div className="bg-surface-2 border border-grid rounded-lg p-2.5 text-sm text-ink whitespace-pre-wrap">{result.about}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
