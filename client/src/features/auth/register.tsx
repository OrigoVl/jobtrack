import { useState } from "react";
import { Link } from "react-router-dom";
import { Btn } from "../../shared/ui";
import { AuthLayout, AuthError, authInputClass } from "./auth-layout";
import { GoogleButton } from "./google-button";
import { signUp } from "../../shared/auth-client";

export function Register() {
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
      setError(signUpError.message || "Couldn't create an account.");
      return;
    }
    setRegistered(true);
  }

  if (registered) {
    return (
      <AuthLayout title="Check your email" subtitle="We sent a verification link to finish creating your account.">
        <p className="text-sm text-ink-dim">
          Click the link in the email, then{" "}
          <Link to="/login" className="text-signal hover:underline">
            log in
          </Link>
          .
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create an account" subtitle="Track your job search, get AI-personalized advice.">
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <AuthError message={error} />}
        <input type="text" required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={authInputClass} />
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
          minLength={8}
          placeholder="Password (min. 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
        />
        <Btn type="submit" loading={loading} className="w-full">
          Create account
        </Btn>
        <GoogleButton />
      </form>
      <div className="mt-4 text-sm">
        <span className="text-ink-dim">Already have an account? </span>
        <Link to="/login" className="text-signal hover:underline">
          Log in
        </Link>
      </div>
    </AuthLayout>
  );
}
