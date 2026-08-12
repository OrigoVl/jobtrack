import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLinkedInOptimize, useLinkedInSaved } from "../../shared/queries";
import { Btn, Card, Chip, Segmented } from "../../shared/ui";
import { SUPPORTED_LOCALES, isAppLocale, DEFAULT_LOCALE, type AppLocale } from "../../i18n/locales";
import type { LinkedInAudit, LinkedInAuditCheckId, LinkedInOptimizeResult } from "../../shared/types";

// LinkedIn's own hard limits, mirrored from cv-linkedin.service.ts's LINKEDIN_*_MAX (which
// enforces them in the response schema) — here they only drive the counter's "over budget" tone,
// so a stale copy can't produce an invalid profile, just a wrong-looking count.
const HEADLINE_MAX = 220;
const ABOUT_MAX = 2600;

const LANGUAGE_LABEL: Record<AppLocale, string> = { en: "English", uk: "Українська" };

/** The audit's check ids are wire values (see types.ts) — they're never translated themselves,
 * only looked up here, the same pattern as fit-tone.ts. */
const CHECK_LABEL_KEY: Record<LinkedInAuditCheckId, string> = {
  headlinePresent: "linkedin.checks.headlinePresent",
  headlineWithinLimit: "linkedin.checks.headlineWithinLimit",
  headlineHasKeyword: "linkedin.checks.headlineHasKeyword",
  aboutPresent: "linkedin.checks.aboutPresent",
  aboutLongEnough: "linkedin.checks.aboutLongEnough",
  aboutWithinLimit: "linkedin.checks.aboutWithinLimit",
  aboutHasKeywords: "linkedin.checks.aboutHasKeywords",
};

/** Copy-to-clipboard button — shows "Copied" for 2s, same pattern as ShareLinkCard's copy button. */
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

/** One generated field: label, character budget, copy button and the text itself. */
function GeneratedField({ label, text, max }: { label: string; text: string; max: number }) {
  const over = text.length > max;
  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs tabular-nums ${over ? "text-rose-600 font-semibold" : "text-ink-dim"}`}>
            {text.length}/{max}
          </span>
          <CopyButton text={text} />
        </div>
      </div>
      <div className="bg-surface-2 border border-grid rounded-lg p-2.5 text-sm text-ink whitespace-pre-wrap">{text}</div>
    </div>
  );
}

/** Scored review of the profile the user pasted in — the part that says what's wrong with what
 * they already have, rather than just handing them replacement text. */
function AuditPanel({ audit }: { audit: LinkedInAudit }) {
  const { t } = useTranslation(["cv", "common"]);
  const tone = audit.score >= 75 ? "text-good" : audit.score >= 50 ? "text-star" : "text-rose-600";
  return (
    <div className="bg-surface-2 border border-grid rounded-lg p-2.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">{t("linkedin.auditTitle")}</span>
        <span className={`text-sm font-mono font-semibold ${tone}`}>{audit.score}/100</span>
      </div>
      <ul className="space-y-0.5">
        {audit.checks.map((check) => (
          <li key={check.id} className="text-xs text-ink flex items-start gap-1.5">
            <span className={check.ok ? "text-good" : "text-rose-600"} aria-hidden="true">
              {check.ok ? "✓" : "✕"}
            </span>
            <span className={check.ok ? "text-ink-dim" : "text-ink"}>{t(CHECK_LABEL_KEY[check.id] as "linkedin.auditTitle")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * LinkedIn profile optimizer — rewrites the headline + About section, ranks the Skills section and
 * suggests "Open to work" titles from the candidate's own profile AND the vacancies they're
 * actually tracking (POST /cv/linkedin-optimize). No LinkedIn API integration (that needs
 * OAuth/partner approval): the user pastes their current profile in and copies the result back
 * out themselves.
 *
 * The language picker is deliberately separate from the app's own language: which language a
 * LinkedIn profile should be in depends on the market being targeted, not on which language the
 * user reads this app in (see cv-linkedin.service.ts). It just STARTS at the UI locale.
 */
export function LinkedInOptimizerCard() {
  const { t, i18n } = useTranslation(["cv", "common"]);
  const optimizeMutation = useLinkedInOptimize();
  const [result, setResult] = useState<LinkedInOptimizeResult | null>(null);
  const [language, setLanguage] = useState<AppLocale>(isAppLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE);
  const [currentHeadline, setCurrentHeadline] = useState("");
  const [currentAbout, setCurrentAbout] = useState("");
  const saved = useLinkedInSaved();

  // Seeds the fields from the last saved profile exactly ONCE. Generating invalidates that query,
  // so without the guard the refetch would race the user's next edit and snap the textarea back to
  // what they submitted — this restores a starting value, it isn't a subscription.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !saved.data) return;
    seeded.current = true;
    setCurrentHeadline(saved.data.current.headline);
    setCurrentAbout(saved.data.current.about);
  }, [saved.data]);

  const hasCurrent = Boolean(currentHeadline.trim() || currentAbout.trim());
  const generate = () =>
    optimizeMutation.mutate(
      { language, current: hasCurrent ? { headline: currentHeadline, about: currentAbout } : undefined },
      { onSuccess: setResult },
    );

  // The generated TEXT survives a remount via the saved blob; the audit and the market-ranked
  // skills/roles deliberately don't (they're derived from a tracker that moves, so showing a
  // restored copy of them would be stale by construction — they reappear on the next generate).
  const headline = result?.headline ?? saved.data?.headline ?? "";
  const about = result?.about ?? saved.data?.about ?? "";

  return (
    // A named landmark rather than a bare div: this card is a self-contained tool sitting in a
    // two-column grid of unrelated cards, so it's worth being reachable/announceable on its own.
    <Card role="region" aria-label={t("linkedin.title")}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-ink">{t("linkedin.title")}</div>
          <p className="text-xs text-ink-dim mt-0.5 max-w-md">{t("linkedin.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={language}
            onChange={setLanguage}
            options={SUPPORTED_LOCALES.map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))}
          />
          <Btn size="sm" loading={optimizeMutation.isPending} onClick={generate}>
            {headline || about ? t("linkedin.regenerate") : t("shared.generate")}
          </Btn>
        </div>
      </div>

      <details className="mt-3 group">
        <summary className="text-xs text-ink-dim cursor-pointer hover:text-ink">{t("linkedin.currentSummary")}</summary>
        <div className="mt-2 space-y-2">
          <input
            className="w-full bg-surface-2 border border-grid rounded-lg p-2 text-sm text-ink"
            value={currentHeadline}
            onChange={(e) => setCurrentHeadline(e.target.value)}
            placeholder={t("linkedin.currentHeadlinePlaceholder")}
            aria-label={t("linkedin.currentHeadlinePlaceholder")}
          />
          <textarea
            className="w-full bg-surface-2 border border-grid rounded-lg p-2 text-sm text-ink min-h-24"
            value={currentAbout}
            onChange={(e) => setCurrentAbout(e.target.value)}
            placeholder={t("linkedin.currentAboutPlaceholder")}
            aria-label={t("linkedin.currentAboutPlaceholder")}
          />
        </div>
      </details>

      {(headline || about) && (
        <div className="mt-3 space-y-3">
          {result?.offline && <Chip tone="amber">{t("linkedin.offlineNotice")}</Chip>}
          {result?.audit && <AuditPanel audit={result.audit} />}
          <GeneratedField label={t("linkedin.headlineLabel")} text={headline} max={HEADLINE_MAX} />
          <GeneratedField label={t("linkedin.aboutLabel")} text={about} max={ABOUT_MAX} />
          {result && result.skills.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">{t("linkedin.skillsLabel")}</span>
                <CopyButton text={result.skills.join("\n")} />
              </div>
              <div className="flex flex-wrap gap-1">
                {result.skills.map((skill) => (
                  <Chip key={skill}>{skill}</Chip>
                ))}
              </div>
              <p className="text-xs text-ink-dim mt-1">{result.marketAware ? t("linkedin.skillsHint") : t("linkedin.noMarketHint")}</p>
            </div>
          )}
          {result && result.targetRoles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-xs font-semibold text-ink-dim uppercase tracking-wide">{t("linkedin.rolesLabel")}</span>
                <CopyButton text={result.targetRoles.join("\n")} />
              </div>
              <div className="flex flex-wrap gap-1">
                {result.targetRoles.map((role) => (
                  <Chip key={role} tone="indigo">
                    {role}
                  </Chip>
                ))}
              </div>
              <p className="text-xs text-ink-dim mt-1">{t("linkedin.rolesHint")}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
