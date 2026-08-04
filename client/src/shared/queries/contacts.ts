import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { ContactInput } from "../types";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useContacts() {
  return useQuery({ queryKey: queryKeys.contacts, queryFn: api.contacts });
}

export function useAddContact() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("contacts");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (c: Partial<ContactInput>) => api.addContact(c),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.contacts });
      toast(t("toasts.contactAdded"), "success");
    },
    onError,
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("contacts");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<ContactInput> }) => api.updateContact(id, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.contacts });
      toast(t("toasts.saved"), "success");
    },
    onError,
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("contacts");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (id: number) => api.deleteContact(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.contacts });
      toast(t("toasts.deleted"), "success");
    },
    onError,
  });
}
