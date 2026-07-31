import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ContactInput } from "../types";
import { useToast } from "../use-toast";
import { queryKeys } from "./keys";

export function useContacts() {
  return useQuery({ queryKey: queryKeys.contacts, queryFn: api.contacts });
}

export function useAddContact() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (c: Partial<ContactInput>) => api.addContact(c),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.contacts });
      toast("Contact added", "success");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "An error occurred", "error"),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<ContactInput> }) => api.updateContact(id, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.contacts });
      toast("Saved", "success");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "An error occurred", "error"),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => api.deleteContact(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.contacts });
      toast("Deleted", "success");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "An error occurred", "error"),
  });
}
