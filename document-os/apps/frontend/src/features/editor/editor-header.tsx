import type { DocumentDetail, DocumentStatus } from "@documentos/shared-types";
import { cn } from "@documentos/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  PanelRight,
  Share2,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOnline } from "@/hooks/use-online";
import { ApiClientError, documentApi } from "@/lib/api-client";
import { useUiStore } from "@/lib/ui-store";
import { useEditorStore } from "./editor-store";
import { ExportMenu } from "./export-menu";

function ShareMenu({ doc }: { doc: DocumentDetail }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const isPublic = doc.is_public ?? false;

  const shareUrl = `${window.location.origin}/share/${doc.id}`;

  const togglePublic = useMutation({
    mutationFn: (nextPublic: boolean) => documentApi.update(doc.id, { is_public: nextPublic }),
    onSuccess: (updated) => {
      queryClient.setQueryData<DocumentDetail>(["document", doc.id], (old) =>
        old ? { ...old, is_public: updated.is_public } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(updated.is_public ? "Document is now publicly accessible!" : "Public access disabled");
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update share settings");
    },
  });

  const handleCopy = () => {
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast.success("Public link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all cursor-pointer shadow-xs select-none",
            isPublic
              ? "border-emerald-300/90 dark:border-emerald-700/80 bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              : "border-indigo-200/80 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 hover:border-[#5551FF] hover:bg-indigo-100/90 dark:hover:bg-indigo-900/60",
          )}
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{isPublic ? "Public" : "Share"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="z-[110] w-84 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/70 bg-popover/95 p-4 shadow-2xl backdrop-blur-md"
      >
        <div className="space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors mt-0.5",
                  isPublic
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Globe className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">Public Link Sharing</p>
                <p className="text-[11px] text-muted-foreground/80 leading-snug">
                  Allow anyone with the link to view and export this document without signing in.
                </p>
              </div>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={(val) => togglePublic.mutate(val)}
              disabled={togglePublic.isPending}
            />
          </div>

          {isPublic ? (
            <div className="space-y-2.5 pt-3 border-t border-border/60">
              <div className="flex items-center gap-1.5">
                <Input
                  readOnly
                  value={shareUrl}
                  className="h-8.5 text-[11px] font-mono text-muted-foreground bg-muted/40 border-indigo-200/50 dark:border-indigo-900/40 rounded-xl"
                />
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={handleCopy}
                  title="Copy public link"
                  className="rounded-xl shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => window.open(shareUrl, "_blank")}
                  title="Open public view page"
                  className="rounded-xl shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/30 px-2.5 py-1 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live • Anonymous visitors can view & export (MD/PDF/HTML/JSON).</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-muted/40 p-2.5 text-[10.5px] text-muted-foreground flex items-center gap-2 border border-border/40">
              <span className="text-sm">🔒</span>
              <span>Private document. Only authorized members of this workspace can view or edit.</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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

function StatusSelector({ doc }: { doc: DocumentDetail }) {
  const queryClient = useQueryClient();
  const commitStatus = useMutation({
    mutationFn: (nextStatus: DocumentStatus) => documentApi.update(doc.id, { status: nextStatus }),
    onMutate: async (nextStatus: DocumentStatus) => {
      await queryClient.cancelQueries({ queryKey: ["document", doc.id] });
      const previous = queryClient.getQueryData<DocumentDetail>(["document", doc.id]);
      queryClient.setQueryData<DocumentDetail>(["document", doc.id], (old) =>
        old ? { ...old, status: nextStatus } : old,
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["document", doc.id], context.previous);
      }
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update status");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["document", doc.id] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const statuses: { value: DocumentStatus; label: string }[] = [
    { value: "draft", label: "Draft" },
    { value: "reviewed", label: "Reviewed" },
    { value: "validated", label: "Validated" },
    { value: "exported", label: "Exported" },
  ];

  const currentLabel = statuses.find((s) => s.value === doc.status)?.label ?? "Draft";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex shrink-0 items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-accent transition-colors focus:outline-none"
        >
          <span className="capitalize">{currentLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:text-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36 text-xs">
        {statuses.map(({ value, label }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => commitStatus.mutate(value)}
            className="flex cursor-pointer items-center justify-between font-medium"
          >
            <span>{label}</span>
            {doc.status === value && <Check className="h-3.5 w-3.5 text-[#5551FF]" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SaveController() {
  const saveStates = useEditorStore((s) => s.saveStates);
  const autoSaveEnabled = useEditorStore((s) => s.autoSaveEnabled);
  const setAutoSaveEnabled = useEditorStore((s) => s.setAutoSaveEnabled);
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

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <button
        type="button"
        onClick={() => {
          const next = !autoSaveEnabled;
          setAutoSaveEnabled(next);
          toast.info(next ? "Auto-save enabled" : "Auto-save disabled");
        }}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 shadow-xs select-none cursor-pointer",
          autoSaveEnabled
            ? "border-[#5551FF]/40 bg-[#5551FF]/10 text-[#5551FF] dark:bg-[#5551FF]/20 dark:text-indigo-300 dark:border-[#5551FF]/50"
            : "border-border/80 bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "relative flex h-4 w-7 items-center rounded-full p-0.5 transition-colors duration-200 shrink-0",
            autoSaveEnabled ? "bg-[#5551FF]" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200",
              autoSaveEnabled ? "translate-x-3" : "translate-x-0",
            )}
          />
        </span>
        <span className="whitespace-nowrap">Auto-save</span>
      </button>

      {!online || aggregate === "offline" ? (
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <WifiOff className="h-3.5 w-3.5" />
          Offline
        </span>
      ) : aggregate === "saving" ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#5551FF]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </span>
      ) : aggregate === "error" ? (
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          Save error
        </span>
      ) : typeof aggregate === "object" ? (
        <span className="hidden sm:flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          Saved
        </span>
      ) : null}
    </div>
  );
}

export function EditorHeader({ doc }: { doc: DocumentDetail }) {
  const navigate = useNavigate();
  const rightCollapsed = useUiStore((s) => s.rightCollapsed);
  const setRightCollapsed = useUiStore((s) => s.setRightCollapsed);

  return (
    <div className="flex h-[52px] items-center justify-between gap-3 border-b border-indigo-200/50 dark:border-indigo-900/40 bg-white/80 dark:bg-zinc-900/80 px-3 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2.5">
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

        <StatusSelector doc={doc} />
        <SaveController />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden rounded-lg border border-indigo-100 dark:border-indigo-950 bg-indigo-50/50 dark:bg-indigo-950/30 px-2.5 py-1 text-xs font-medium text-muted-foreground/90 md:inline-block">
          {doc.word_count.toLocaleString()} words
        </span>
        <span className="hidden rounded-lg border border-indigo-100 dark:border-indigo-950 bg-indigo-50/50 dark:bg-indigo-950/30 px-2.5 py-1 text-xs font-medium text-muted-foreground/90 lg:inline-block">
          {Math.max(1, Math.ceil(doc.word_count / 200))} min read
        </span>

        <div className="mx-1 h-4 w-px bg-border/60" aria-hidden />

        <ShareMenu doc={doc} />
        <ExportMenu documentId={doc.id} title={doc.title} />

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
