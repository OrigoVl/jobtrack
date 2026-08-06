import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { CalendarEventInput } from "../types";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

// `range` is part of the query key (like admin's `days`, see queries/admin.ts) — switching
// months in the calendar fetches (and caches) a distinct result per month instead of silently
// reusing a previous month's data. `refetchInterval` is opt-in (undefined by default, i.e. no
// polling) — only calendar-reminder-notifier.tsx's "watch for events starting soon" use passes
// one; the Calendar page's own month-view fetch doesn't need to poll in the background.
export function useCombinedCalendar(range: { from?: string; to?: string }, options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: [...queryKeys.calendarCombined, range.from, range.to],
    queryFn: () => api.calendarCombined(range),
    refetchInterval: options.refetchInterval,
  });
}

export function useAddCalendarEvent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("calendar");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (e: CalendarEventInput) => api.addCalendarEvent(e),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.calendarCombined });
      toast(t("toasts.added"), "success");
    },
    onError,
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("calendar");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<CalendarEventInput> }) => api.updateCalendarEvent(id, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.calendarCombined });
      toast(t("toasts.saved"), "success");
    },
    onError,
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("calendar");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (id: number) => api.deleteCalendarEvent(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.calendarCombined });
      toast(t("toasts.deleted"), "success");
    },
    onError,
  });
}
