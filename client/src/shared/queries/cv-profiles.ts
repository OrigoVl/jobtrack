import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

/** The CV Builder's tab strip — summary rows only (no doc/presets, see api.cvDoc/cvPresets for
 * a single tab's own content). */
export function useCvProfiles() {
  return useQuery({ queryKey: queryKeys.cvProfiles, queryFn: api.cvProfiles });
}

export function useCreateCvProfile() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (name: string) => api.createCvProfile(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cvProfiles }),
    onError,
  });
}

export function useDuplicateCvProfile() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (id: number) => api.duplicateCvProfile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cvProfiles }),
    onError,
  });
}

export function useRenameCvProfile() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.renameCvProfile(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cvProfiles }),
    onError,
  });
}

export function useDeleteCvProfile() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (id: number) => api.deleteCvProfile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cvProfiles }),
    onError,
  });
}
