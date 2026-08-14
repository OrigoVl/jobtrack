import { useCallback, useRef, useState, type ReactNode } from "react";
import type { Toast, ToastType } from "./types";
import { ToastContext } from "./toast-context";

/**
 * A lightweight context for toast messages, isolated from app data. It used to live inside
 * the "big" StoreContext along with all the app's data — any toast triggered a re-render of
 * every useStore() consumer. Split out separately so toasts don't affect components that only
 * work with data (vacancies/profile/analytics, etc.).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "info", onAction?: () => void) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type, onAction }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return <ToastContext.Provider value={{ toasts, toast, dismissToast }}>{children}</ToastContext.Provider>;
}
