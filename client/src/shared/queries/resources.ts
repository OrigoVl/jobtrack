import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { queryKeys } from "./keys";

export function useResources() {
  return useQuery({ queryKey: queryKeys.resources, queryFn: api.resources });
}
