import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Btn } from "../../shared/ui";
import { AuthLayout, AuthError, authInputClass } from "./auth-layout";
import { resetPassword } from "../../shared/auth-client";

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthLayout title="Invalid reset link" subtitle="This link is missing its token — request a new one.">
        <Link to="/forgot-password" className="text-indigo-600 hover:underline text-sm">
          Request a new reset link
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
      setError(resetError.message || "That link may have expired — request a new one.");
      return;
    }
    navigate("/login", { replace: true });
  }

  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <AuthError message={error} />}
        <input
          type="password"
          required
          minLength={8}
          placeholder="New password (min. 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
        />
        <Btn type="submit" loading={loading} className="w-full">
          Set new password
        </Btn>
      </form>
    </AuthLayout>
  );
}
