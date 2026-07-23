import type { DocumentDetail } from "@documentos/shared-types";
import { formatRelativeTime } from "@documentos/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardCheck,
  Loader2,
  PanelRight,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOnline } from "@/hooks/use-online";
import { ApiClientError, documentApi } from "@/lib/api-client";
import { useUiStore } from "@/lib/ui-store";
import { useEditorStore } from "./editor-store";
import { ExportMenu } from "./export-menu";

function TitleInput({ doc }: { doc: DocumentDetail }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(doc.title);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setTitle(doc.title);
  }, [doc.title, editing]);

  const commit = useMutation({
    mutationFn: (next: string) => documentApi.update(doc.id, { title: next }),
    onSuccess: (updated) => {
      queryClient.setQueryData<DocumentDetail>(["document", doc.id], (old) =>
        old ? { ...old, title: updated.title } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err) => {
      setTitle(doc.title);
      toast.error(err instanceof ApiClientError ? err.message : "Failed to rename document");
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
        if (next && next !== doc.title) commit.mutate(next);
        else setTitle(doc.title);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setTitle(doc.title);
          e.currentTarget.blur();
        }
      }}
      aria-label="Document title"
      className="w-full truncate rounded-md bg-transparent px-2 py-1 text-sm font-semibold tracking-tight outline-none transition-colors hover:bg-accent/60 focus:bg-accent focus:ring-1 focus:ring-ring"
    />
  );
}

function SaveIndicator() {
  const saveStates = useEditorStore((s) => s.saveStates);
  const online = useOnline();

  const aggregate = useMemo(() => {
    const states = Object.values(saveStates);
    if (states.some((s) => s.state === "saving")) return "saving" as const;
    if (states.some((s) => s.state === "offline")) return "offline" as const;
    if (states.some((s) => s.state === "error")) return "error" as const;
    const latest = states
      .filter((s) => s.state === "saved" && s.savedAt)
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0];
    if (latest) return { kind: "saved" as const, at: latest.savedAt! };
    return "idle" as const;
  }, [saveStates]);

  if (!online || aggregate === "offline") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-amber-500">
        <WifiOff className="h-3.5 w-3.5" />
        Offline
      </span>
    );
  }
  if (aggregate === "saving") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (aggregate === "error") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        Save failed
      </span>
    );
  }
  if (typeof aggregate === "object") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-emerald-500" />
        Saved · {formatRelativeTime(new Date(aggregate.at).toISOString())}
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground/60">
      <Check className="h-3.5 w-3.5" />
      Idle
    </span>
  );
}

export function EditorHeader({ doc }: { doc: DocumentDetail }) {
  const navigate = useNavigate();
  const requestValidate = useEditorStore((s) => s.requestValidate);
  const requestReview = useEditorStore((s) => s.requestReview);
  const setGenerateOpen = useEditorStore((s) => s.setGenerateOpen);
  const rightCollapsed = useUiStore((s) => s.rightCollapsed);
  const setRightCollapsed = useUiStore((s) => s.setRightCollapsed);

  return (
    <div className="flex h-[52px] items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-3 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Back to dashboard" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to dashboard</TooltipContent>
        </Tooltip>

        <div className="min-w-0 max-w-xs sm:max-w-md md:max-w-lg">
          <TitleInput doc={doc} />
        </div>

        <DocumentStatusBadge status={doc.status} className="hidden shrink-0 sm:inline-flex" />
        <SaveIndicator />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="hidden rounded bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground/80 md:inline-block">
          {doc.word_count.toLocaleString()} words
        </span>

        <div className="mx-1 h-4 w-px bg-border/60" aria-hidden />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 text-xs" onClick={requestValidate}>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span className="hidden lg:inline">Validate</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run structural validation</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 text-xs" onClick={requestReview}>
              <ClipboardCheck className="h-3.5 w-3.5 text-indigo-500" />
              <span className="hidden lg:inline">Review</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run AI quality review</TooltipContent>
        </Tooltip>

        <ExportMenu documentId={doc.id} title={doc.title} />

        <Button
          size="sm"
          className="h-8 gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 px-3 text-xs font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
          onClick={() => setGenerateOpen(true)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Toggle inspector"
              onClick={() => setRightCollapsed(!rightCollapsed)}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle inspector</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
