// Hook for accessing the toast context — kept in a separate file from ToastProvider (toast.tsx),
// so react-refresh correctly recognizes toast.tsx as a file that only exports a component.
import { useContext } from "react";
import { ToastContext, type ToastApi } from "./toast-context";

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside a <ToastProvider>");
  return ctx;
}
