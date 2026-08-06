import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Btn } from "../../shared/ui";
import { AuthLayout, AuthError, authInputClass } from "./auth-layout";
import { PasswordInput } from "./password-input";
import { GoogleButton } from "./google-button";
import { signUp } from "../../shared/auth-client";

export function Register() {
  const { t } = useTranslation("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signUpError } = await signUp.email({ name, email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message || t("register.errors.generic"));
      return;
    }
    setRegistered(true);
  }

  if (registered) {
    return (
      <AuthLayout title={t("register.checkEmail.title")} subtitle={t("register.checkEmail.subtitle")}>
        <p className="text-sm text-ink-dim">
          {t("register.checkEmail.instructions")}{" "}
          <Link to="/login" className="text-ink-dim hover:text-signal hover:underline">
            {t("register.checkEmail.logIn")}
          </Link>
          .
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("register.title")} subtitle={t("register.subtitle")}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <AuthError message={error} />}
        <input
          type="text"
          required
          placeholder={t("fields.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={authInputClass}
        />
        <input
          type="email"
          required
          placeholder={t("fields.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
        />
        <PasswordInput required minLength={8} placeholder={t("register.passwordPlaceholder")} value={password} onChange={setPassword} />
        <Btn type="submit" loading={loading} className="w-full">
          {t("register.submit")}
        </Btn>
        <GoogleButton />
      </form>
      <div className="mt-4 text-sm">
        <span className="text-ink-dim">{t("register.alreadyHaveAccount")}</span>
        <Link to="/login" className="text-ink-dim hover:text-signal hover:underline">
          {t("register.logIn")}
        </Link>
      </div>
    </AuthLayout>
  );
}
