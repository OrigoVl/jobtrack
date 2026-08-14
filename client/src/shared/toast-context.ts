// Context and types for the toast system — kept separate from toast.tsx (component) and
// use-toast.ts (hook), so react-refresh can unambiguously tell which file is "component-only".
import { createContext } from "react";
import type { Toast, ToastType } from "./types";

export interface ToastApi {
  toasts: Toast[];
  toast: (message: string, type?: ToastType, onAction?: () => void) => void;
  dismissToast: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
