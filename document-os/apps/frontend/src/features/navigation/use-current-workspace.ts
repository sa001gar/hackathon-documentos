import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { documentApi, projectApi, workspaceApi } from "@/lib/api-client";
import { useUiStore } from "@/lib/ui-store";

export function useWorkspaces() {
  return useQuery({ queryKey: ["workspaces"], queryFn: workspaceApi.list });
}

/** Resolves the active workspace (persisted choice, else the first one). */
export function useCurrentWorkspace() {
  const query = useWorkspaces();
  const lastId = useUiStore((s) => s.lastWorkspaceId);
  const setLastId = useUiStore((s) => s.setLastWorkspaceId);

  const workspace = useMemo(() => {
    const list = query.data ?? [];
    if (!list.length) return undefined;
    return list.find((w) => w.id === lastId) ?? list[0];
  }, [query.data, lastId]);

  useEffect(() => {
    if (workspace && workspace.id !== lastId) setLastId(workspace.id);
  }, [workspace, lastId, setLastId]);

  return { ...query, workspace };
}

export function useProjects(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => projectApi.list(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useProjectDocuments(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["documents", projectId],
    queryFn: () => documentApi.list(projectId!),
    enabled: !!projectId && enabled,
  });
}

/** All documents across every project of a workspace, most recently updated first. */
export function useWorkspaceDocuments(workspaceId: string | undefined) {
  const { data: projects, isLoading: projectsLoading } = useProjects(workspaceId);
  const combined = useQueries({
    queries: (projects ?? []).map((p) => ({
      queryKey: ["documents", p.id] as const,
      queryFn: () => documentApi.list(p.id),
    })),
    combine: (results) => ({
      documents: results
        .flatMap((r) => r.data ?? [])
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      isLoading: results.some((r) => r.isLoading),
    }),
  });
  return {
    documents: combined.documents,
    isLoading: projectsLoading || combined.isLoading,
    projects: projects ?? [],
  };
}
