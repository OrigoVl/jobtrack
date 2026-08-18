import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { ApiToken, ApiTokenInput } from "../types";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useApiTokens() {
  return useQuery({ queryKey: queryKeys.apiTokens, queryFn: api.apiTokens });
}

export function useCreateApiToken() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("account");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (input: ApiTokenInput) => api.createApiToken(input),
    // The list endpoint (GET /mcp/tokens) never returns the raw secret — the server only echoes
    // `{id, token}` back here, so the cache is updated from the id plus the input we already sent,
    // not from the response body. The raw `token` itself is read straight off the mutation result
    // by the caller (Account) and kept in local component state, never written to the cache.
    onSuccess: (created, input) => {
      qc.setQueryData(queryKeys.apiTokens, (old: ApiToken[] | undefined) => [
        ...(old ?? []),
        {
          id: created.id,
          label: input.label,
          scope: input.scope,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          expiresAt: input.expiresAt ?? null,
          revokedAt: null,
        },
      ]);
      toast(t("apiTokens.create.toast"), "success");
    },
    onError,
  });
}

export function useRevokeApiToken() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("account");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (id: number) => api.revokeApiToken(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.apiTokens });
      toast(t("apiTokens.revoke.toast"), "success");
    },
    onError,
  });
}
