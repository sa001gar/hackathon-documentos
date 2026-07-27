import { cn, formatRelativeTime } from "@documentos/utils";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Clock,
  Copy,
  FileText,
  Filter,
  MessageSquare,
  RotateCcw,
  Sparkles,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { documentApi } from "@/lib/api-client";
import { useComposerStore } from "@/features/editor/composer-store";
import { useEditorStore } from "@/features/editor/editor-store";

export function PromptsTab({ documentId }: { documentId: string }) {
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [filterUserOnly, setFilterUserOnly] = useState(false);

  // 1. Fetch user-entered prompt thread history for this document
  const threads = useComposerStore((s) => s.threads);
  const fallbackThread = useComposerStore((s) => s.thread);
  const requestFocus = useComposerStore((s) => s.requestFocus);
  const clearThread = useComposerStore((s) => s.clearThread);

  const documentThread = threads[documentId] ?? fallbackThread ?? [];

  // 2. Fetch document sections to display user-specified section AI instructions
  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentApi.get(documentId),
  });

  const setScrollTarget = useEditorStore((s) => s.setScrollTarget);

  const copyPromptText = (text: string, id: number | string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Prompt copied to clipboard");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const reusePrompt = (text: string) => {
    requestFocus();
    void navigator.clipboard.writeText(text);
    toast.success("Prompt loaded into composer!");
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-border/50 p-2.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  // Filter sections with user custom AI instructions
  const sectionUserPrompts = (doc?.sections ?? []).filter((s) => Boolean(s.ai_prompt && s.ai_prompt.trim()));

  // Filter messages based on toggle
  const displayedThread = filterUserOnly
    ? documentThread.filter((m) => m.role === "user")
    : documentThread;

  const totalUserPrompts = documentThread.filter((m) => m.role === "user").length;

  return (
    <div className="space-y-4 p-3 h-full overflow-y-auto custom-scrollbar">
      {/* Header & Filter Controls */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          <span>User Prompt History</span>
          <Badge variant="secondary" className="h-4 text-[10px] px-1.5 font-bold">
            {totalUserPrompts}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant={filterUserOnly ? "default" : "ghost"}
            className="h-6 text-[10px] gap-1 px-2"
            onClick={() => setFilterUserOnly((v) => !v)}
            title="Toggle User Prompts Only"
          >
            <Filter className="h-2.5 w-2.5" />
            {filterUserOnly ? "User Only" : "All Messages"}
          </Button>

          {documentThread.length > 0 && (
            <Button
              size="xs"
              variant="ghost"
              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
              onClick={() => clearThread(documentId)}
              title="Clear Prompt History for this Document"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* User Prompts Feed */}
      {displayedThread.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 text-center">
          <MessageSquare className="mx-auto h-7 w-7 text-muted-foreground/50 mb-2" />
          <h4 className="text-xs font-semibold text-foreground">No prompts submitted yet</h4>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            Prompts you enter in the AI Composer dock will be saved here per document.
          </p>
          <Button
            size="xs"
            variant="outline"
            className="mt-3 gap-1.5 text-xs font-medium border-primary/40 hover:bg-primary/5 text-primary"
            onClick={requestFocus}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Open AI Composer Dock
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayedThread.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "group relative rounded-xl border p-3 text-xs transition-all shadow-xs",
                msg.role === "user"
                  ? "border-primary/40 bg-indigo-50/40 dark:bg-indigo-950/20 text-foreground"
                  : "border-border/60 bg-card text-muted-foreground",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {msg.role === "user" ? (
                    <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-[10px] font-semibold text-primary">
                      <User className="h-2.5 w-2.5" /> User Prompt
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-indigo-400/40 bg-indigo-500/10 text-[10px] font-semibold text-indigo-400">
                      <Sparkles className="h-2.5 w-2.5" /> AI Response
                    </Badge>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <Clock className="h-2.5 w-2.5" />
                    {formatRelativeTime(new Date(msg.at).toISOString())}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => copyPromptText(msg.text, msg.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Copy prompt text"
                  >
                    {copiedId === msg.id ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  {msg.role === "user" && (
                    <button
                      type="button"
                      onClick={() => reusePrompt(msg.text)}
                      className="rounded p-1 text-primary hover:bg-primary/10"
                      title="Reuse prompt in AI Composer"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-[12.5px] font-normal">
                {msg.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* User Section Instructions */}
      {sectionUserPrompts.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Section Instructions ({sectionUserPrompts.length})
            </span>
          </div>
          <div className="space-y-2">
            {sectionUserPrompts.map((sec) => (
              <div
                key={sec.id}
                className="group rounded-xl border border-border/60 bg-card p-2.5 text-xs transition-colors hover:border-primary/40 shadow-xs"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-foreground truncate max-w-[180px]">
                    {sec.title}
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setScrollTarget(sec.id)}
                    className="h-5 text-[10px] text-primary"
                  >
                    Jump to Section
                  </Button>
                </div>
                <p className="italic text-muted-foreground text-[11.5px] bg-muted/40 p-2 rounded-lg border border-border/40 leading-relaxed">
                  "{sec.ai_prompt}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
