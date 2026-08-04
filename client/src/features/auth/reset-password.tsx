import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Btn } from "../../shared/ui";
import { AuthLayout, AuthError, authInputClass } from "./auth-layout";
import { resetPassword } from "../../shared/auth-client";

export function ResetPassword() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthLayout title={t("resetPassword.invalidLink.title")} subtitle={t("resetPassword.invalidLink.subtitle")}>
        <Link to="/forgot-password" className="text-signal hover:underline text-sm">
          {t("resetPassword.invalidLink.requestNew")}
        </Link>
      </AuthLayout>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: resetError } = await resetPassword({ newPassword: password, token });
    setLoading(false);
    if (resetError) {
      setError(resetError.message || t("resetPassword.errors.generic"));
      return;
    }
    navigate("/login", { replace: true });
  }

  return (
    <AuthLayout title={t("resetPassword.title")}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <AuthError message={error} />}
        <input
          type="password"
          required
          minLength={8}
          placeholder={t("resetPassword.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
        />
        <Btn type="submit" loading={loading} className="w-full">
          {t("resetPassword.submit")}
        </Btn>
      </form>
    </AuthLayout>
  );
}
