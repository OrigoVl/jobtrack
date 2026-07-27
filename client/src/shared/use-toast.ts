// Хук доступу до toast-контексту — окремий файл від ToastProvider (toast.tsx), щоб
// react-refresh коректно розпізнавав toast.tsx як файл, що експортує лише компонент.
import { useContext } from "react";
import { ToastContext, type ToastApi } from "./toast-context";

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast має використовуватись усередині <ToastProvider>");
  return ctx;
}
