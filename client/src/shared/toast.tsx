import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { Toast, ToastType } from "./types";

interface ToastApi {
  toasts: Toast[];
  toast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Легкий, ізольований від даних контекст для toast-повідомлень. Раніше жив усередині
 * "великого" StoreContext разом з усіма даними застосунку — будь-який toast викликав
 * ре-рендер кожного споживача useStore(). Винесений окремо, щоб toasts не зачіпали
 * компоненти, які працюють лише з даними (вакансії/профіль/аналітика тощо).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return <ToastContext.Provider value={{ toasts, toast, dismissToast }}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast має використовуватись усередині <ToastProvider>");
  return ctx;
}
