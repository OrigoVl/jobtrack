import { useState } from "react";
import { Link } from "react-router-dom";
import { Btn } from "../../shared/ui";
import { AuthLayout, AuthError, authInputClass } from "./auth-layout";
import { requestPasswordReset } from "../../shared/auth-client";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: resetError } = await requestPasswordReset({ email, redirectTo: "/reset-password" });
    setLoading(false);
    // Deliberately show the same "sent" state even on error — an account-enumeration guard
    // (a login-guessing attacker shouldn't be able to tell a registered email apart from an
    // unregistered one from this response).
    if (resetError) {
      setError(null);
    }
    setSent(true);
  }

  if (sent) {
    return <AuthLayout title="Check your email" subtitle="If that email is registered, we sent a link to reset your password." />;
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send a reset link.">
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <AuthError message={error} />}
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
        />
        <Btn type="submit" loading={loading} className="w-full">
          Send reset link
        </Btn>
      </form>
      <div className="mt-4 text-sm">
        <Link to="/login" className="text-indigo-600 hover:underline">
          Back to log in
        </Link>
      </div>
    </AuthLayout>
  );
}
