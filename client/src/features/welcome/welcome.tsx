import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Btn, Wordmark } from "../../shared/ui";
import { useMarkWelcomeSeen, useProfile, useSaveProfile } from "../../shared/queries";

/**
 * A stranger's first screen after registering — deliberately NOT the full dashboard, whose
 * onboarding checklist (dashboard.tsx) is built for "you, resuming a fresh account," not "you,
 * seeing this product for the first time ever." Two short steps, always skippable, mirroring
 * AuthLayout's centered-card look (a little wider — this needs more room than a login form) so
 * it reads as part of the same auth-adjacent moment, not the main app chrome.
 *
 * Captures ONE high-leverage input (target role/domain) that immediately improves skill-radar,
 * roadmap, and job-search relevance — everything else genuinely can wait. Marks
 * onboarding.welcomeSeen server-side (server/src/modules/onboarding/) on finish/skip so this
 * page is never shown to the same account twice; see app/App.tsx's redirect in AuthGate.
 */
export function Welcome() {
  const { t } = useTranslation("welcome");
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const saveProfile = useSaveProfile();
  const markSeen = useMarkWelcomeSeen();
  const [step, setStep] = useState<1 | 2>(1);
  const [domain, setDomain] = useState("");

  async function finish(path: string) {
    await markSeen.mutateAsync();
    navigate(path, { replace: true });
  }

  async function continueFromStep1() {
    const trimmed = domain.trim();
    if (trimmed && profile) {
      await saveProfile.mutateAsync({ ...profile, domain: trimmed });
    }
    setStep(2);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Wordmark size="lg" />
        </div>
        <div className="rounded-xl bg-surface border border-grid p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-dim">{t("stepIndicator", { step, total: 2 })}</span>
            <button className="text-xs text-ink-dim hover:text-signal hover:underline" onClick={() => finish("/dashboard")}>
              {t("skip")}
            </button>
          </div>

          {step === 1 ? (
            <div className="mt-3">
              <h1 className="text-lg font-bold text-ink">{t("step1.title")}</h1>
              <p className="text-sm text-ink-dim mt-1">{t("step1.subtitle")}</p>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void continueFromStep1()}
                placeholder={t("step1.placeholder")}
                aria-label={t("step1.placeholder")}
                className="w-full mt-4 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
              />
              <Btn className="w-full mt-4" loading={saveProfile.isPending} onClick={continueFromStep1}>
                {t("continue")}
              </Btn>
            </div>
          ) : (
            <div className="mt-3">
              <h1 className="text-lg font-bold text-ink">{t("step2.title")}</h1>
              <p className="text-sm text-ink-dim mt-1">{t("step2.subtitle")}</p>
              <div className="mt-4 space-y-2">
                <Btn className="w-full" loading={markSeen.isPending} onClick={() => finish("/vacancies")}>
                  {t("step2.addVacancy")}
                </Btn>
                <Btn className="w-full" variant="ghost" loading={markSeen.isPending} onClick={() => finish("/dashboard")}>
                  {t("step2.goToDashboard")}
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
