import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FilePlus2, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentTree } from "@/hooks/use-document-tree";
import { ApiClientError, documentApi, sectionApi, usersApi } from "@/lib/api-client";
import { useUiStore } from "@/lib/ui-store";
import { VersionsPanel } from "@/features/versions/versions-panel";
import { AiComposer } from "./ai-composer";
import { EditorHeader } from "./editor-header";
import { EditorToolbar } from "./editor-toolbar";
import { useEditorStore } from "./editor-store";
import { GenerateDialog } from "./generate-dialog";
import { PlanningState } from "./planning-state";
import { useGenerationStore } from "./generation-store";
import { useExportDocument } from "./export-menu";
import { SectionCard } from "./section-card";

function EditorSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
      <Skeleton className="h-8 w-2/3" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}

export function EditorPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const queryClient = useQueryClient();
  const {
    data: doc,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentApi.get(documentId!),
    enabled: !!documentId,
  });
  const { tree, flat } = useDocumentTree(doc);
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: usersApi.settings,
    staleTime: 120_000,
  });
  const autosaveInterval = settings?.autosave_interval_ms ?? 1500;

  const setLastDocumentId = useUiStore((s) => s.setLastDocumentId);
  const setGenerateOpen = useEditorStore((s) => s.setGenerateOpen);
  const scrollTarget = useEditorStore((s) => s.scrollTarget);
  const setScrollTarget = useEditorStore((s) => s.setScrollTarget);
  const requestedAction = useEditorStore((s) => s.requestedAction);
  const clearRequestedAction = useEditorStore((s) => s.clearRequestedAction);
  const resetSaveStates = useEditorStore((s) => s.resetSaveStates);

  const genPhase = useGenerationStore((s) => (s.documentId === documentId ? s.phase : "idle"));
  const currentSectionId = useGenerationStore((s) =>
    s.documentId === documentId ? s.currentSectionId : null,
  );
  const clearSectionContext = useEditorStore((s) => s.clearSectionContext);
  const prevGenPhase = useRef<string>("idle");

  useEffect(() => {
    if (documentId) setLastDocumentId(documentId);
    resetSaveStates();
    clearSectionContext();
  }, [documentId, setLastDocumentId, resetSaveStates, clearSectionContext]);

  // Toast on generation completion/failure (only while this doc is open).
  useEffect(() => {
    if (genPhase !== prevGenPhase.current) {
      if (genPhase === "completed") toast.success("Document generation complete");
      if (genPhase === "failed") toast.error(useGenerationStore.getState().error ?? "Generation failed");
    }
    prevGenPhase.current = genPhase;
  }, [genPhase]);

  // Gently follow the section the AI is currently writing.
  useEffect(() => {
    if (!currentSectionId) return;
    const t = window.setTimeout(() => {
      const el = window.document.getElementById(`section-${currentSectionId}`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const visible = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!visible) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => window.clearTimeout(t);
  }, [currentSectionId]);

  // Scroll requests from the outline / palette / validation issues.
  useEffect(() => {
    if (!scrollTarget || !doc) return;
    const t = window.setTimeout(() => {
      window.document
        .getElementById(`section-${scrollTarget}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollTarget(null);
    }, 120);
    return () => window.clearTimeout(t);
  }, [scrollTarget, doc, setScrollTarget]);

  const { exportDocument } = useExportDocument(documentId, doc?.title ?? "document");
  useEffect(() => {
    if (requestedAction === "export") {
      exportDocument("markdown");
      clearRequestedAction();
    }
  }, [requestedAction, exportDocument, clearRequestedAction]);

  const addRootSection = useMutation({
    mutationFn: () =>
      sectionApi.create(documentId!, { title: "Untitled section", order_index: flat.length }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to add section"),
  });

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border/60 px-3 py-2">
          <Skeleton className="h-8 w-1/2" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <EditorSkeleton />
        </div>
      </div>
    );
  }

  if (isError || !doc) {
    const notFound = error instanceof ApiClientError && error.status === 404;
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorState
          message={
            notFound
              ? "This document doesn't exist or you don't have access to it."
              : error instanceof ApiClientError
                ? error.message
                : "Could not load the document."
          }
          onRetry={notFound ? undefined : () => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <EditorHeader doc={doc} />
      <EditorToolbar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mx-auto max-w-4xl px-4 sm:px-6 pb-44 pt-6"
        >
          {(genPhase === "connecting" || genPhase === "planning") && <PlanningState />}
          {flat.length === 0 ? (
            genPhase !== "connecting" && genPhase !== "planning" && (
              <div className="rounded-lg border border-dashed border-border">
                <EmptyState
                  icon={FilePlus2}
                  title="This document is empty"
                  hint="Add sections manually, or let the AI plan and write the whole document from a prompt."
                  actionLabel="Generate with AI"
                  onAction={() => setGenerateOpen(true)}
                />
                <div className="flex justify-center pb-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => addRootSection.mutate()}
                    disabled={addRootSection.isPending}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add a section instead
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-8">
              {tree.map((node) => (
                <SectionCard
                  key={node.id}
                  node={node}
                  depth={0}
                  documentId={doc.id}
                  autosaveInterval={autosaveInterval}
                />
              ))}
              <div className="flex justify-start pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground/70 hover:text-muted-foreground"
                  onClick={() => addRootSection.mutate()}
                  disabled={addRootSection.isPending}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add section
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
      <AiComposer doc={doc} />
      <GenerateDialog document={doc} />
      <VersionsPanel />
    </div>
  );
}
