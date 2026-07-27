import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { queryKeys } from "./keys";

export function useLearn() {
  return useQuery({ queryKey: queryKeys.learn, queryFn: api.learn });
}
