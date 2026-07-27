// Контекст і типи для toast-системи — винесені окремо від toast.tsx (компонент) і
// use-toast.ts (хук), щоб react-refresh міг однозначно визначити, який файл є "лише компонент".
import { createContext } from "react";
import type { Toast, ToastType } from "./types";

export interface ToastApi {
  toasts: Toast[];
  toast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
