import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ResourcesData } from "../types";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useResources() {
  return useQuery({ queryKey: queryKeys.resources, queryFn: api.resources });
}

/** Sets the user's own focus note, or clears it back to auto with an empty string.
 * Setting one patches the cache directly — the server echoes the exact stored text, so there is
 * nothing left to learn from a refetch. Clearing does need one: the automatic focus is
 * regenerated server-side (LLM or the deterministic fallback) and the client can't reproduce it. */
export function useSetResourcesFocus() {
  const qc = useQueryClient();
  const onErrorToast = useMutationErrorToast();
  return useMutation({
    mutationFn: (text: string) => api.setResourcesFocus(text),
    onSuccess: (res) => {
      if (!res.focusCustom) {
        void qc.invalidateQueries({ queryKey: queryKeys.resources });
        return;
      }
      qc.setQueryData<ResourcesData>(queryKeys.resources, (cur) => (cur ? { ...cur, focus: res.focus, focusCustom: true } : cur));
    },
    onError: onErrorToast,
  });
}
