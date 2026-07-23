import type { DocumentDetail, SectionNode } from "@documentos/shared-types";
import { cn } from "@documentos/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, GripVertical, History, Plus, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SectionStatusChip } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSectionStream } from "@/hooks/use-sse-stream";
import { ApiClientError, sectionApi } from "@/lib/api-client";
import { countWords } from "@/lib/markdown";
import { useEditorStore } from "./editor-store";
import { useGenerationStore } from "./generation-store";
import { SectionEditor } from "./section-editor";
import { StreamOverlay } from "./stream-overlay";
import { QueuedBody, StreamingBody } from "./streaming-body";

interface SectionCardProps {
  node: SectionNode;
  depth: number;
  documentId: string;
  autosaveInterval: number;
}

/** Patch one section inside the cached DocumentDetail. */
function patchSection(
  qc: ReturnType<typeof useQueryClient>,
  documentId: string,
  sectionId: string,
  patch: Partial<SectionNode>,
) {
  qc.setQueryData<DocumentDetail>(["document", documentId], (old) =>
    old
      ? {
        ...old,
        sections: old.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
      }
      : old,
  );
}

function SectionTitle({ node, documentId }: { node: SectionNode; documentId: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(node.title);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setTitle(node.title);
  }, [node.title, editing]);

  const commit = useMutation({
    mutationFn: (next: string) => sectionApi.update(node.id, { title: next }),
    onSuccess: (updated) => {
      patchSection(queryClient, documentId, node.id, { title: updated.title });
    },
    onError: (err) => {
      setTitle(node.title);
      toast.error(err instanceof ApiClientError ? err.message : "Failed to rename section");
    },
  });

  return (
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        setEditing(false);
        const next = title.trim();
        if (next && next !== node.title) commit.mutate(next);
        else setTitle(node.title);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setTitle(node.title);
          e.currentTarget.blur();
        }
      }}
      aria-label="Section title"
      className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[14px] font-medium outline-none transition-colors hover:bg-accent/60 focus:bg-accent focus:ring-1 focus:ring-ring"
    />
  );
}

export function SectionCard({ node, depth, documentId, autosaveInterval }: SectionCardProps) {
  const queryClient = useQueryClient();
  const setVersionsSectionId = useEditorStore((s) => s.setVersionsSectionId);
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const stream = useSectionStream();

  // Live pipeline state for this section (stable refs → only this card
  // re-renders when its own status/tokens change).
  const genSection = useGenerationStore((s) => s.sections.find((x) => x.id === node.id));
  const genActive = useGenerationStore((s) => s.phase === "generating" || s.phase === "planning");
  const pipelineStreaming = genSection?.status === "generating";
  const queued = genActive && genSection?.status === "queued";
  const pipelineFailed = genSection?.status === "failed";

  // Auto-expand when the pipeline starts writing this section.
  useEffect(() => {
    if (pipelineStreaming) setCollapsed(false);
  }, [pipelineStreaming]);

  // Live word count while the pipeline streams this section.
  const liveWords = useMemo(
    () => (pipelineStreaming && genSection ? countWords(genSection.tokens) : null),
    [pipelineStreaming, genSection],
  );

  const beginStream = () => {
    stream.start(node.id, undefined, {
      onDone: (section) => {
        patchSection(queryClient, documentId, node.id, {
          content: section.content,
          status: section.status,
          word_count: section.word_count,
        });
        toast.success("Section generated");
      },
      onError: (message) => {
        patchSection(queryClient, documentId, node.id, { status: "error" });
        toast.error(message);
      },
    });
  };

  const addChild = useMutation({
    mutationFn: () =>
      sectionApi.create(documentId, {
        title: "Untitled section",
        parent_id: node.id,
        order_index: node.children.length,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to add section"),
  });

  const remove = useMutation({
    mutationFn: () => sectionApi.remove(node.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Section deleted");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete section"),
  });

  const actions: { icon: typeof WandSparkles; label: string; onClick: () => void; disabled?: boolean }[] = [
    {
      icon: WandSparkles,
      label: "Generate with AI",
      onClick: () => {
        if (node.content.trim()) setConfirmOverwrite(true);
        else beginStream();
      },
      disabled: stream.streaming,
    },
    { icon: Plus, label: "Add child section", onClick: () => addChild.mutate(), disabled: addChild.isPending },
    { icon: History, label: "Version history", onClick: () => setVersionsSectionId(node.id) },
    { icon: Trash2, label: "Delete section", onClick: () => setConfirmDelete(true) },
  ];

  return (
    <div id={`section-${node.id}`} className="scroll-mt-20">
      <div
        className={cn(
          "group rounded-xl border border-border/80 bg-card shadow-sm transition-all duration-200 hover:border-border hover:shadow-md",
          (node.status === "error" || pipelineFailed) && "border-destructive/40",
          (stream.streaming || pipelineStreaming) && "border-primary/40 shadow-md ring-1 ring-primary/10",
          queued && "opacity-80",
        )}
      >
        <div className="flex items-center gap-1 px-2 pt-1.5">
          <GripVertical
            className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40"
            aria-hidden
          />
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand section" : "Collapse section"}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")}
            />
          </button>
          <SectionTitle node={node} documentId={documentId} />
          <span
            className={cn(
              "hidden shrink-0 text-[11px] tabular-nums text-muted-foreground/70 sm:inline",
              liveWords !== null && "font-medium text-primary",
            )}
          >
            {(liveWords ?? node.word_count).toLocaleString()} words
          </span>
          {queued ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              queued
            </span>
          ) : (
            <SectionStatusChip
              status={
                stream.streaming || pipelineStreaming
                  ? "generating"
                  : pipelineFailed
                    ? "error"
                    : node.status
              }
            />
          )}
          <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {actions.map(({ icon: Icon, label, onClick, disabled }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={label}
                    onClick={onClick}
                    disabled={disabled}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
        {!collapsed && (
          <div className="relative px-3 pb-2 pt-1">
            {pipelineStreaming ? (
              <StreamingBody tokens={genSection?.tokens ?? ""} />
            ) : queued ? (
              <QueuedBody />
            ) : (
              <SectionEditor section={node} documentId={documentId} autosaveInterval={autosaveInterval} />
            )}
            {stream.streaming && <StreamOverlay tokens={stream.tokens} onStop={stream.abort} />}
          </div>
        )}
      </div>

      {node.children.length > 0 && (
        <div className="ml-5 border-l border-border/50 pl-4 pt-3">
          <div className="space-y-3">
            {node.children.map((child) => (
              <SectionCard
                key={child.id}
                node={child}
                depth={depth + 1}
                documentId={documentId}
                autosaveInterval={autosaveInterval}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={confirmOverwrite} onOpenChange={setConfirmOverwrite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate this section?</DialogTitle>
            <DialogDescription>
              AI generation will replace the current content of "{node.title}". Previous versions
              stay available in the version history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOverwrite(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOverwrite(false);
                beginStream();
              }}
            >
              <WandSparkles className="h-4 w-4" />
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete "{node.title}"?</DialogTitle>
            <DialogDescription>
              This removes the section{node.children.length > 0 ? " and its entire subtree" : ""}.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                setConfirmDelete(false);
                remove.mutate();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
