import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Btn } from "../../shared/ui";
import { AuthLayout, AuthError, authInputClass } from "./auth-layout";
import { PasswordInput } from "./password-input";
import { SocialButtons } from "./social-buttons";
import { signIn } from "../../shared/auth-client";

export function Login() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await signIn.email({ email, password });
    setLoading(false);
    if (signInError) {
      setError(
        signInError.code === "EMAIL_NOT_VERIFIED" ? t("login.errors.emailNotVerified") : signInError.message || t("login.errors.generic"),
      );
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <AuthLayout title={t("login.title")} subtitle={t("login.subtitle")}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <AuthError message={error} />}
        <input
          type="email"
          required
          placeholder={t("fields.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
        />
        <PasswordInput required placeholder={t("login.passwordPlaceholder")} value={password} onChange={setPassword} />
        <Btn type="submit" loading={loading} className="w-full">
          {t("login.submit")}
        </Btn>
        <SocialButtons />
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link to="/register" className="text-ink-dim hover:text-signal hover:underline">
          {t("login.createAccount")}
        </Link>
        <Link to="/forgot-password" className="text-ink-dim hover:underline">
          {t("login.forgotPassword")}
        </Link>
      </div>
    </AuthLayout>
  );
}
