import { useState } from "react";
import { useLinkedInOptimize } from "../../shared/queries";
import { Btn, Card, Chip } from "../../shared/ui";
import type { LinkedInOptimizeResult } from "../../shared/types";

/** Copy-to-clipboard button — shows "✓ Copied" for 2s, same pattern as ShareLinkCard's copy button. */
function CopyButton({ text }: { text: string }) {
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
      {copied ? "✓ Copied" : "Copy"}
    </Btn>
  );
}

/**
 * LinkedIn profile optimizer — generates a headline + About section from the candidate's own
 * profile (POST /cv/linkedin-optimize). No LinkedIn API integration (that needs OAuth/partner
 * approval) — this only produces text the user copies into their own profile themselves.
 */
export function LinkedInOptimizerCard() {
  const optimizeMutation = useLinkedInOptimize();
  const [result, setResult] = useState<LinkedInOptimizeResult | null>(null);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-ink">💼 LinkedIn profile optimizer</div>
          <p className="text-xs text-ink-dim mt-0.5 max-w-md">
            Generates a headline + "About" section from your profile/CV — copy it straight into LinkedIn. No LinkedIn account access needed
            or used.
          </p>
        </div>
        <Btn size="sm" loading={optimizeMutation.isPending} onClick={() => optimizeMutation.mutate(undefined, { onSuccess: setResult })}>
          {result ? "↻ Regenerate" : "Generate"}
        </Btn>
      </div>
      {result && (
        <div className="mt-3 space-y-3">
          {result.offline && <Chip tone="amber">Offline template — enable LLM in server/.env for a personalized version</Chip>}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">Headline</span>
              <CopyButton text={result.headline} />
            </div>
            <div className="bg-surface-2 border border-grid rounded-lg p-2.5 text-sm text-ink">{result.headline}</div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">About</span>
              <CopyButton text={result.about} />
            </div>
            <div className="bg-surface-2 border border-grid rounded-lg p-2.5 text-sm text-ink whitespace-pre-wrap">{result.about}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
