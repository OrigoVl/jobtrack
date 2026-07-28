import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { queryKeys } from "./keys";

/** LLM flag + backend connectivity check. Doesn't change without a server restart — cache it for a long time. */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.health,
    staleTime: Infinity,
    retry: 2,
  });
}
