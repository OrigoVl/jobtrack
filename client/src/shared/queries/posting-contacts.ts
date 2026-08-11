import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { useMutationErrorToast } from "../use-error-toast";

/** Reads the contacts a posting states out of its own text. A one-shot action rather than a cached
 * query (same shape as useContactOutreach): the result belongs to the calling component's state,
 * and it mutates nothing server-side, so there's nothing to invalidate. Nothing is guessed — the
 * server only returns values that appear verbatim in the source text. */
export function useExtractPostingContacts() {
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (input: { vacancyId?: number; text?: string }) => api.extractPostingContacts(input),
    onError,
  });
}

/** Reads the addresses a company publishes on its own site. One-shot like the extraction hook
 * above; the server decides which pages to read and honors the site's robots.txt. */
export function useScanCompanySite() {
  const onError = useMutationErrorToast();
  return useMutation({ mutationFn: (companyId: number) => api.scanCompanySite(companyId), onError });
}
