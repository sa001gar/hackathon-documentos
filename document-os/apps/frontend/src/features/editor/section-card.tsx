import type { DocumentDetail, SectionNode } from "@documentos/shared-types";
import { cn } from "@documentos/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlignLeft, Check, ChevronDown, Copy, FileText, History, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PencilSparkles } from "@/components/ui/pencil-sparkles";
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

function SectionTitle({ node, documentId, depth }: { node: SectionNode; documentId: string; depth: number }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(node.title);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setTitle(node.title);
  }, [node.title, editing]);

  const commit = useMutation({
    mutationFn: (next: string) => sectionApi.update(node.id, { title: next }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ["document", documentId] });
      const previous = queryClient.getQueryData<DocumentDetail>(["document", documentId]);
      patchSection(queryClient, documentId, node.id, { title: next });
      return { previous };
    },
    onError: (err, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["document", documentId], context.previous);
      }
      setTitle(node.title);
      toast.error(err instanceof ApiClientError ? err.message : "Failed to rename section");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
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
      className={cn(
        "min-w-0 flex-1 rounded bg-transparent py-0.5 outline-none transition-colors placeholder:text-muted-foreground/40 hover:bg-accent/40 focus:bg-accent/60",
        depth === 0 && "text-[17px] font-semibold tracking-tight",
        depth === 1 && "text-[15px] font-semibold",
        depth >= 2 && "text-[14px] font-medium",
      )}
      placeholder="Untitled section"
    />
  );
}

function markdownToPlainText(md: string): string {
  return md
    .replace(/^#+\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```[a-z]*/g, ""))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .trim();
}

function CopySectionMenu({ node }: { node: SectionNode }) {
  const [copied, setCopied] = useState(false);

  const copyMarkdown = () => {
    const md = `# ${node.title}\n\n${node.content}`;
    void navigator.clipboard.writeText(md);
    setCopied(true);
    toast.success(`Copied "${node.title}" as Markdown`);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyPlainText = () => {
    const plain = `${node.title}\n\n${markdownToPlainText(node.content)}`;
    void navigator.clipboard.writeText(plain);
    setCopied(true);
    toast.success(`Copied "${node.title}" as Plain Text`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Copy section content">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Copy section content</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-48 text-xs rounded-xl p-1 shadow-xl z-[110]">
        <DropdownMenuItem onClick={copyMarkdown} className="flex cursor-pointer items-center gap-2 rounded-lg font-medium">
          <FileText className="h-3.5 w-3.5 text-[#5551FF]" />
          <span>Copy as Markdown</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyPlainText} className="flex cursor-pointer items-center gap-2 rounded-lg font-medium">
          <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Copy as Plain Text</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["document", documentId] });
      const previous = queryClient.getQueryData<DocumentDetail>(["document", documentId]);
      const tempId = `temp-${Date.now()}`;
      const newSection: SectionNode = {
        id: tempId,
        document_id: documentId,
        parent_id: node.id,
        title: "Untitled section",
        content: "",
        order_index: node.children.length,
        status: "draft",
        word_count: 0,
        ai_prompt: null,
        metadata: {},
        children: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData<DocumentDetail>(["document", documentId], (old) =>
        old ? { ...old, sections: [...old.sections, newSection] } : old,
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["document", documentId], context.previous);
      }
      toast.error(err instanceof ApiClientError ? err.message : "Failed to add section");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    },
  });

  const remove = useMutation({
    mutationFn: () => sectionApi.remove(node.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["document", documentId] });
      const previous = queryClient.getQueryData<DocumentDetail>(["document", documentId]);
      queryClient.setQueryData<DocumentDetail>(["document", documentId], (old) =>
        old
          ? {
              ...old,
              sections: old.sections.filter((s) => s.id !== node.id && s.parent_id !== node.id),
            }
          : old,
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["document", documentId], context.previous);
      }
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete section");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Section deleted");
    },
  });

  const actions: { icon: typeof PencilSparkles; label: string; onClick: () => void; disabled?: boolean }[] = [
    {
      icon: PencilSparkles,
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
          "group relative transition-all duration-150",
          depth > 0
            ? "my-2.5 rounded-xl border border-indigo-100/90 dark:border-indigo-950/80 bg-gradient-to-r from-[#F8FAFC]/90 via-[#F1F5F9]/40 to-white dark:from-zinc-900/50 dark:via-zinc-900/30 dark:to-zinc-950/50 p-3 sm:p-4 shadow-sm shadow-indigo-500/5 hover:border-indigo-200 dark:hover:border-indigo-900/70"
            : "rounded-lg py-1",
          pipelineStreaming && "bg-indigo-50/40 dark:bg-indigo-950/30",
        )}
      >
        {/* Title row */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand section" : "Collapse section"}
            className="rounded p-1 text-muted-foreground/60 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/60 hover:text-foreground focus-visible:outline-none transition-colors shrink-0"
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-150", collapsed && "-rotate-90")}
            />
          </button>

          {depth > 0 && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#5551FF]/60 shrink-0" aria-hidden />
          )}

          <SectionTitle node={node} documentId={documentId} depth={depth} />
          <span
            className={cn(
              "hidden shrink-0 text-[11px] tabular-nums text-muted-foreground/50 sm:inline",
              liveWords !== null && "font-medium text-primary",
            )}
          >
            {(liveWords ?? node.word_count).toLocaleString()} words
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {queued ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                queued
              </span>
            ) : pipelineStreaming || stream.streaming ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                writing
              </span>
            ) : pipelineFailed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                failed
              </span>
            ) : null}
          </span>
          <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <CopySectionMenu node={node} />
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

        {/* Body */}
        {!collapsed && (
          <div className="relative mt-1 pl-6 min-w-0 max-w-full">
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

      {node.children.length > 0 && !collapsed && (
        <div className="ml-3 sm:ml-4 mt-2.5 space-y-3 border-l-2 border-indigo-200/60 dark:border-indigo-900/50 pl-3 sm:pl-4 min-w-0 max-w-full">
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
              <PencilSparkles className="h-4 w-4" />
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
