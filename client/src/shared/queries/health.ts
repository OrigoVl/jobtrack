import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { queryKeys } from "./keys";

/** Прапорець LLM + перевірка звʼязку з бекендом. Не змінюється без рестарту сервера — тримаємо довго. */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.health,
    staleTime: Infinity,
    retry: 2,
  });
}
