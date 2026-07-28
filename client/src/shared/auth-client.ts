// Single better-auth client instance. No `baseURL` — requests go to the current origin's /api/auth/*
// (proxied to the API server in dev via vite.config.ts, same-origin in prod), exactly like every
// other request in shared/api.ts.
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export const { useSession, signIn, signUp, signOut, requestPasswordReset, resetPassword } = authClient;
