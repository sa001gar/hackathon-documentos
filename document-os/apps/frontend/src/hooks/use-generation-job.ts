import type { GenerationJob } from "@documentos/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { aiApi } from "@/lib/api-client";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function isJobTerminal(job: GenerationJob | undefined): boolean {
  return !job || TERMINAL.has(job.status);
}

/**
 * Polls a generation job every 1.5s until terminal; while active also polls the
 * document every 3s so section statuses flip live. Invalidates on completion.
 */
export function useGenerationJob(jobId: string | null, documentId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => aiApi.getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data && TERMINAL.has(q.state.data.status) ? false : 1500),
    staleTime: 0,
  });

  const active = !!query.data && !TERMINAL.has(query.data.status);

  // While running: poll the document itself so the tree reflects per-section progress.
  useEffect(() => {
    if (!active || !documentId) return;
    const t = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    }, 3000);
    return () => clearInterval(t);
  }, [active, documentId, queryClient]);

  // On terminal: final invalidations.
  useEffect(() => {
    if (query.data && TERMINAL.has(query.data.status) && documentId) {
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["activity", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  }, [query.data?.status, documentId, queryClient, query.data]);

  return { job: query.data ?? null, active, isLoading: query.isLoading };
}
