import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn } from "../../shared/ui";
import { useAuthConfig } from "../../shared/queries";
import { signIn } from "../../shared/auth-client";

/** Renders nothing if Google OAuth isn't configured server-side (GOOGLE_CLIENT_ID/SECRET unset). */
export function GoogleButton() {
  const { t } = useTranslation("auth");
  const { data } = useAuthConfig();
  const [loading, setLoading] = useState(false);
  if (!data?.googleEnabled) return null;

  return (
    <Btn
      type="button"
      variant="ghost"
      className="w-full"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        await signIn.social({ provider: "google", callbackURL: "/" });
      }}
    >
      {t("google.continue")}
    </Btn>
  );
}
