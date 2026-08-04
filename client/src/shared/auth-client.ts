// Single better-auth client instance. No `baseURL` — requests go to the current origin's /api/auth/*
// (proxied to the API server in dev via vite.config.ts, same-origin in prod), exactly like every
// other request in shared/api.ts.
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import i18n from "../i18n";

export const authClient = createAuthClient({
  plugins: [adminClient()],
  fetchOptions: {
    // shared/api.ts's req() carries the same header on every other endpoint — better-auth's own
    // /api/auth/* routes (including the 3 email-sending callbacks in server/src/auth/auth.ts)
    // bypass api.ts entirely, so they need it added here instead. Read live at request time (not
    // captured once at client-creation) so a language switch takes effect on the very next call.
    onRequest(context) {
      context.headers.set("x-locale", i18n.language);
      return context;
    },
  },
});

export const { useSession, signIn, signUp, signOut, requestPasswordReset, resetPassword, deleteUser } = authClient;
