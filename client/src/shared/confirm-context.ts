import { createContext } from "react";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" (red confirm button) for a destructive action like delete; "primary" for anything
   * else that just needs a "are you sure" gate. Defaults to "danger" — every current call site is
   * a delete confirmation, and a neutral-tone confirm button on a destructive action is easy to
   * misclick as harmless. */
  tone?: "danger" | "primary";
}

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

// Kept in its own file (not confirm.tsx) so react-refresh recognizes confirm.tsx as exporting
// only a component — same split as toast-context.ts/toast.tsx.
export const ConfirmContext = createContext<ConfirmFn | null>(null);
