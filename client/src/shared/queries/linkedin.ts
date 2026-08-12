import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { queryKeys } from "./keys";
import { useMutationErrorToast } from "../use-error-toast";
import type { AppLocale } from "../../i18n/locales";
import type { SavedLinkedInProfile } from "../types";

/** The last generated/pasted LinkedIn profile, so the card comes back filled in instead of blank.
 * null when nothing has been generated yet. */
export function useLinkedInSaved() {
  return useQuery<SavedLinkedInProfile | null>({
    queryKey: queryKeys.linkedinSaved,
    queryFn: () => api.linkedinSaved(),
  });
}

// The generated text itself is held in the calling component's own state (a one-shot "generate"
// action, like /learn/plan) — this only invalidates the SAVED copy the server persisted as a side
// effect of generating, so a later remount restores the same profile.
export function useLinkedInOptimize() {
  const onError = useMutationErrorToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { language: AppLocale; current?: { headline: string; about: string } }) =>
      api.linkedinOptimize(vars.language, vars.current),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.linkedinSaved }),
    onError,
  });
}
