// Hook for accessing the confirm-dialog context — kept in a separate file from
// ConfirmDialogProvider (confirm.tsx), so react-refresh correctly recognizes confirm.tsx as a
// file that only exports a component (same reasoning as use-toast.ts/toast.tsx).
import { useContext } from "react";
import { ConfirmContext, type ConfirmFn } from "./confirm-context";

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside a <ConfirmDialogProvider>");
  return ctx;
}
