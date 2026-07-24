import type { DocumentDetail } from "@documentos/shared-types";
import { cn } from "@documentos/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AtSign,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Maximize2,
  Minus,
  Play,
  SendHorizonal,
  Sparkles,
  Square,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { aiApi, ApiClientError } from "@/lib/api-client";
import { useEditorStore } from "./editor-store";
import { useGenerationStore, type GenPhase } from "./generation-store";

type ComposerTab = "write" | "review" | "diagram" | "research";

const TABS: { id: ComposerTab; label: string; enabled: boolean }[] = [
  { id: "write", label: "Write", enabled: true },
  { id: "review", label: "Review", enabled: true },
  { id: "diagram", label: "Diagram", enabled: false },
  { id: "research", label: "Research", enabled: false },
];

const AGENTS = [
  { id: "auto", label: "Auto (Planner + Writer)" },
  { id: "planner", label: "Planner" },
  { id: "writer", label: "Writer" },
  { id: "reviewer", label: "Reviewer" },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];

const PHASE_LABEL: Record<GenPhase, string> = {
  idle: "",
  connecting: "Connecting…",
  planning: "Planning outline…",
  generating: "Writing",
  completed: "Generation complete",
  failed: "Generation failed",
  cancelled: "Generation cancelled",
};

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Live pipeline status strip rendered inside the composer while generating. */
function GenerationStrip() {
  const phase = useGenerationStore((s) => s.phase);
  const total = useGenerationStore((s) => s.totalSections);
  const completed = useGenerationStore((s) => s.completedCount);
  const failed = useGenerationStore((s) => s.failedCount);
  const startedAt = useGenerationStore((s) => s.startedAt);
  const currentTitle = useGenerationStore(
    (s) => s.sections.find((x) => x.id === s.currentSectionId)?.title ?? null,
  );
  const cancel = useGenerationStore((s) => s.cancel);
  const resume = useGenerationStore((s) => s.resume);
  const reset = useGenerationStore((s) => s.reset);

  const active = phase === "connecting" || phase === "planning" || phase === "generating";
  const now = useNow(active);
  const elapsed = startedAt ? now - startedAt : 0;

  useEffect(() => {
    if (phase === "completed") {
      const t = setTimeout(() => reset(), 5000);
      return () => clearTimeout(t);
    }
  }, [phase, reset]);

  if (phase === "idle") return null;

  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-indigo-200/70 bg-white/90 dark:border-indigo-900/50 dark:bg-zinc-900/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur-md">
      {active ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#5551FF]" />
      ) : phase === "completed" ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
      )}
      <span className="min-w-0 flex-1 truncate text-[11.5px]">
        <span className="font-semibold text-foreground">{PHASE_LABEL[phase]}</span>
        {currentTitle && active && <span className="text-muted-foreground"> · {currentTitle}</span>}
        <span className="ml-2 tabular-nums text-muted-foreground/80 font-medium">
          {completed}/{total}
          {failed > 0 && <span className="text-destructive font-semibold"> · {failed} failed</span>}
          {startedAt && ` · ${formatDuration(elapsed)}`}
        </span>
      </span>
      {active && (
        <button
          type="button"
          onClick={cancel}
          className="flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground shadow-sm"
        >
          <Square className="h-3 w-3" />
          Stop
        </button>
      )}
      {(phase === "failed" || phase === "cancelled") && (
        <button
          type="button"
          onClick={() => void resume()}
          className="flex shrink-0 items-center gap-1 rounded-md border border-indigo-200 bg-[#5551FF]/10 px-2 py-0.5 text-[11px] font-semibold text-[#5551FF] transition-all hover:bg-[#5551FF]/20 shadow-sm"
        >
          <Play className="h-3 w-3" />
          Resume
        </button>
      )}
      {!active && (
        <button
          type="button"
          onClick={reset}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * The permanent floating AI composer — movable & minimizable.
 */
export function AiComposer({ doc }: { doc: DocumentDetail }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ComposerTab>("write");
  const [agent, setAgent] = useState<AgentId>("auto");
  const [prompt, setPrompt] = useState("");
  const [minimized, setMinimized] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const start = useGenerationStore((s) => s.start);
  const phase = useGenerationStore((s) => (s.documentId === doc.id ? s.phase : "idle"));
  const running = phase === "connecting" || phase === "planning" || phase === "generating";
  const requestReview = useEditorStore((s) => s.requestReview);
  const activeSectionTitle = useEditorStore((s) => s.activeSectionTitle);
  const clearSectionContext = useEditorStore((s) => s.clearSectionContext);

  const review = useMutation({
    mutationFn: () => aiApi.review(doc.id),
    onSuccess: (report) => {
      useEditorStore.getState().setReview(doc.id, report);
      requestReview();
      toast.success(`Review complete — score ${report.overall_score}/100`);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Review failed"),
  });

  // Auto-resize the textarea up to ~8 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [prompt]);

  const submit = () => {
    const text = prompt.trim();
    if (!text || running) return;
    if (tab === "write") {
      setPrompt("");
      void start(doc.id, text, doc.section_count > 0);
    } else if (tab === "review") {
      setPrompt("");
      review.mutate();
    }
  };

  const canSubmit = prompt.trim().length > 0 && !running && (tab === "write" || tab === "review") && !review.isPending;

  if (minimized) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex justify-center px-4">
        <motion.div
          drag
          dragMomentum={false}
          className="pointer-events-auto flex items-center gap-2.5 rounded-full border-2 border-[#5551FF]/70 bg-gradient-to-r from-indigo-50/95 via-white/95 to-violet-50/90 dark:from-zinc-900/95 dark:via-zinc-950/95 dark:to-indigo-950/80 px-4 py-2 text-xs font-semibold text-foreground shadow-lg shadow-[#5551FF]/20 backdrop-blur-2xl cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-1.5 text-[#5551FF]">
            <Sparkles className="h-4 w-4" />
            <span>AI Assistant</span>
          </div>
          {running && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-[#5551FF]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Writing…
            </span>
          )}
          <button
            type="button"
            onClick={() => setMinimized(false)}
            aria-label="Expand AI Assistant"
            className="ml-1 rounded-full bg-[#5551FF]/10 p-1 text-[#5551FF] transition-colors hover:bg-[#5551FF]/20"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex justify-center px-4">
      <motion.div
        drag
        dragMomentum={false}
        className="pointer-events-auto w-full max-w-2xl cursor-default"
      >
        {/* Glowing gradient background box with rounded border */}
        <div className="rounded-2xl border-2 border-[#5551FF]/60 dark:border-[#6366F1]/60 bg-gradient-to-br from-indigo-50/90 via-white/95 to-violet-50/80 dark:from-zinc-900/95 dark:via-zinc-950/95 dark:to-indigo-950/60 shadow-xl shadow-[#5551FF]/15 backdrop-blur-2xl p-3 space-y-1.5">
          {/* Header tab row & Drag handle */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1">
                {TABS.map((t) => (
                  <Tooltip key={t.id}>
                    <TooltipTrigger asChild>
                      <span>
                        <button
                          type="button"
                          disabled={!t.enabled}
                          onClick={() => setTab(t.id)}
                          className={cn(
                            "rounded-xl px-3 py-1 text-xs font-semibold transition-all duration-200",
                            tab === t.id
                              ? "bg-[#5551FF] text-white shadow-sm scale-[1.02]"
                              : "text-muted-foreground/70 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
                            !t.enabled && "cursor-not-allowed opacity-40",
                          )}
                        >
                          {t.label}
                        </button>
                      </span>
                    </TooltipTrigger>
                    {!t.enabled && <TooltipContent side="top">Coming soon</TooltipContent>}
                  </Tooltip>
                ))}
              </div>

            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
                <Sparkles className="h-3.5 w-3.5 text-[#5551FF]" />
                Gemma 4
              </span>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimize AI Assistant"
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="px-1 pt-1">
            <GenerationStrip />

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder={
                tab === "write"
                  ? "Ask AI to write or improve this document…"
                  : tab === "review"
                    ? "What should the Reviewer focus on? (optional)"
                    : "Select a tab above…"
              }
              disabled={!TABS.find((t) => t.id === tab)?.enabled}
              className="w-full resize-none bg-transparent px-1 py-1 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground/50 font-normal"
            />

            {/* Context chips */}
            <div className="my-1.5 flex flex-wrap items-center gap-1.5 px-1">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#5551FF]/10 border border-[#5551FF]/25 px-2.5 py-0.5 text-[11px] font-semibold text-[#5551FF] shadow-sm">
                <FileText className="h-3.5 w-3.5" />
                {doc.title}
              </span>
              {activeSectionTitle && (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#5551FF] px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs">
                  {activeSectionTitle}
                  <button
                    type="button"
                    aria-label="Remove section context"
                    onClick={clearSectionContext}
                    className="rounded-full p-0.5 transition-colors hover:bg-white/25"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>

            {/* Bottom pills & action button */}
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 px-3 py-1 text-[11.5px] font-medium text-foreground/80 shadow-sm transition-all hover:border-[#5551FF]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#5551FF]" />
                      {AGENTS.find((a) => a.id === agent)?.label ?? "Auto"}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" sideOffset={6} className="z-[110] text-xs rounded-xl p-1 shadow-md">
                    {AGENTS.map((a) => (
                      <DropdownMenuItem key={a.id} onClick={() => setAgent(a.id)} className="rounded-lg cursor-pointer">
                        {a.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 px-3 py-1 text-[11.5px] font-medium text-foreground/80 shadow-sm transition-all hover:border-[#5551FF]"
                    >
                      <AtSign className="h-3.5 w-3.5 text-[#5551FF]" />
                      Context
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Attach context (coming soon)</TooltipContent>
                </Tooltip>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                aria-label="Send"
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                  canSubmit
                    ? "bg-[#5551FF] text-white shadow-md shadow-[#5551FF]/25 hover:bg-[#4540FF] hover:scale-105 active:scale-95"
                    : "bg-muted/80 text-muted-foreground/40",
                )}
              >
                {review.isPending || running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
