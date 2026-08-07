import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn } from "../../shared/ui";
import { useAuthConfig } from "../../shared/queries";
import { signIn } from "../../shared/auth-client";

const SOCIAL_PROVIDERS = [
  { provider: "google", flag: "googleEnabled", labelKey: "google.continue" },
  { provider: "linkedin", flag: "linkedinEnabled", labelKey: "linkedin.continue" },
] as const;

/** Renders one "Continue with …" button per social provider configured server-side (env vars set). */
export function SocialButtons() {
  const { t } = useTranslation("auth");
  const { data } = useAuthConfig();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  const enabled = SOCIAL_PROVIDERS.filter((p) => data?.[p.flag]);
  if (enabled.length === 0) return null;

  return (
    <>
      {enabled.map(({ provider, labelKey }) => (
        <Btn
          key={provider}
          type="button"
          variant="ghost"
          className="w-full"
          loading={pendingProvider === provider}
          onClick={async () => {
            setPendingProvider(provider);
            await signIn.social({ provider, callbackURL: "/" });
          }}
        >
          {t(labelKey)}
        </Btn>
      ))}
    </>
  );
}
