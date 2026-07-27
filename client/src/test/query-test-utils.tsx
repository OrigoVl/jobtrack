// Спільна обгортка для тестів TanStack Query хуків: власний QueryClient (без
// retry/gcTime "шуму" в тестах) + ToastProvider, бо useToast() кидає без нього.
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../shared/toast";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function createQueryWrapper(queryClient: QueryClient = createTestQueryClient()) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, queryClient };
}
