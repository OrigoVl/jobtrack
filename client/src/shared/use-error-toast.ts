import { useTranslation } from "react-i18next";
import { useToast } from "./use-toast";

/** The `onError: (e) => toast(...)` line every mutation hook in `shared/queries/*.ts` used to
 * repeat inline — hoisted here so there's exactly one place that decides how an unknown mutation
 * error becomes a toast, and one place the fallback message is translated. Server error messages
 * themselves (e.g. `e.message` from an `HttpError`) are shown as-is UNLESS the server also sent a
 * stable `code` (`server/src/core/http.ts`'s optional 4th `HttpError` param, surfaced by
 * `client/src/shared/api.ts`'s `handleResponse`) that matches a translated `common:errors.<code>`
 * key — only the ~10 error sites a normal user can actually trigger during real use have one; the
 * rest fall back to the raw (English) `message`, same as before. */
export function useMutationErrorToast() {
  const { toast } = useToast();
  const { t } = useTranslation();
  return (e: unknown) => {
    if (e instanceof Error) {
      const code = (e as Error & { code?: string }).code;
      // Key is necessarily built at runtime from the server's `code` — i18next's literal-key
      // typing can't verify it (same escape hatch as shared/status-labels.ts's statusLabel()).
      // defaultValue falls back to the raw message when `code` is absent/unrecognized.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast(code ? t(`errors.${code}` as any, { defaultValue: e.message }) : e.message, "error");
      return;
    }
    toast(t("errors.generic"), "error");
  };
}
