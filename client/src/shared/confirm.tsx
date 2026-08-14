import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Btn } from "./ui";
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from "./confirm-context";

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/** App-wide confirmation gate for destructive actions (delete vacancy/contact/calendar
 * event/saved search, ban a user, …) — promise-based so a call site just does
 * `if (!(await confirm({...}))) return;` instead of threading its own open/onConfirm state.
 * Mount once near the app root (see App.tsx), same pattern as ToastProvider. */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })), []);

  const close = useCallback(
    (result: boolean) => {
      pending?.resolve(result);
      setPending(null);
    },
    [pending],
  );

  // Escape cancels, same as PopoverPanel's outside-click-to-close convention elsewhere in the app.
  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, close]);

  // Focuses the confirm button on open without the disallowed `autoFocus` prop (project eslint
  // config bans it — a plain ref+effect keeps focus management explicit and testable).
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pending) confirmBtnRef.current?.focus();
  }, [pending]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending &&
        createPortal(
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4"
            onClick={() => close(false)}
          >
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              className="w-full max-w-sm rounded-2xl bg-surface border border-grid shadow-lg p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div id="confirm-dialog-title" className="font-semibold text-ink">
                {pending.title}
              </div>
              {pending.message && <p className="text-sm text-ink-dim mt-2">{pending.message}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Btn variant="ghost" size="sm" onClick={() => close(false)}>
                  {pending.cancelLabel ?? t("actions.cancel")}
                </Btn>
                <Btn ref={confirmBtnRef} variant={pending.tone === "primary" ? "primary" : "danger"} size="sm" onClick={() => close(true)}>
                  {pending.confirmLabel ?? t("actions.delete")}
                </Btn>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}
