import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient instance. Exported so non-React modules (e.g. the
 * generation store) can patch/invalidate caches even when no component
 * that owns the stream is currently mounted.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
