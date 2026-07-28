import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Btn } from "../../shared/ui";
import { AuthLayout, AuthError, authInputClass } from "./auth-layout";
import { GoogleButton } from "./google-button";
import { signIn } from "../../shared/auth-client";

export function Login() {
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
        signInError.code === "EMAIL_NOT_VERIFIED"
          ? "Verify your email first — check your inbox for the link we sent when you registered."
          : signInError.message || "Couldn't sign in — check your email and password.",
      );
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <AuthLayout title="Log in" subtitle="Welcome back.">
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
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
        />
        <Btn type="submit" loading={loading} className="w-full">
          Log in
        </Btn>
        <GoogleButton />
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link to="/register" className="text-indigo-600 hover:underline">
          Create an account
        </Link>
        <Link to="/forgot-password" className="text-slate-500 hover:underline">
          Forgot password?
        </Link>
      </div>
    </AuthLayout>
  );
}
