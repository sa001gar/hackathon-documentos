import type { DocumentDetail, RefineAction } from "@documentos/shared-types";
import { cn } from "@documentos/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  GripHorizontal,
  Loader2,
  Maximize2,
  MessagesSquare,
  Minus,
  Pencil,
  Play,
  RotateCcw,
  SendHorizonal,
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
import { aiApi, ApiClientError } from "@/lib/api-client";
import { useComposerStore } from "./composer-store";
import { useEditorStore } from "./editor-store";
import { useGenerationStore, type GenPhase } from "./generation-store";

type ComposerTab = "write" | "review";

const TABS: { id: ComposerTab; label: string }[] = [
  { id: "write", label: "Write & Edit" },
  { id: "review", label: "Review" },
];

const AGENTS = [
  { id: "auto", label: "Auto (Planner + Writer)" },
  { id: "planner", label: "Planner Only" },
  { id: "writer", label: "Writer Only" },
  { id: "reviewer", label: "Reviewer Only" },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];

const SECTION_INTENTS: [RegExp, RefineAction][] = [
  [/\brewrite\b/i, "rewrite"],
  [/\b(improve|polish|better)\b/i, "improve"],
  [/\b(shorten|condense|trim)\b/i, "shorten"],
  [/\b(expand|elaborate|longer)\b/i, "expand"],
  [/\bprofessional\b/i, "professional"],
  [/\bacademic\b/i, "academic"],
  [/\blegal\b/i, "legal"],
  [/\b(friendly|casual)\b/i, "friendly"],
  [/\bgrammar\b/i, "fix_grammar"],
  [/\b(summarize|summary|tl;dr)\b/i, "summarize"],
  [/\b(continue|keep writing)\b/i, "continue"],
  [/\btranslate\b/i, "translate"],
];

const REGENERATE_RE = /\b(regenerate|re-?write (the|this) section)\b/i;

function detectSectionAction(prompt: string): RefineAction | "regenerate" | null {
  if (REGENERATE_RE.test(prompt)) return "regenerate";
  for (const [re, action] of SECTION_INTENTS) {
    if (re.test(prompt)) return action;
  }
  return null;
}

const PHASE_LABEL: Record<GenPhase, string> = {
  idle: "",
  connecting: "Connecting to AI…",
  planning: "Structuring document outline…",
  generating: "Writing document sections",
  completed: "Generation complete",
  failed: "Generation failed",
  cancelled: "Generation stopped",
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

/** Live pipeline status strip rendered inside the floating dock while generating. */
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

  const pct = total > 0 ? Math.round((completed / total) * 100) : active ? 15 : 100;

  return (
    <div className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-50/50 p-2.5 dark:border-indigo-500/30 dark:bg-indigo-950/30">
      {/* Animated subtle progress bar line */}
      <div
        className="absolute bottom-0 left-0 top-0 bg-indigo-500/10 transition-all duration-300 dark:bg-indigo-500/20"
        style={{ width: `${pct}%` }}
      />

      <div className="relative flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {active ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#5551FF]" />
          ) : phase === "completed" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          )}

          <div className="min-w-0 flex-1 truncate">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <span>{PHASE_LABEL[phase]}</span>
              {startedAt && (
                <span className="text-[11px] font-mono text-muted-foreground/80">
                  {formatDuration(elapsed)}
                </span>
              )}
            </div>
            {currentTitle && active && (
              <p className="truncate text-[11px] text-muted-foreground">Writing: {currentTitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {active && (
            <button
              type="button"
              onClick={cancel}
              className="flex items-center gap-1 rounded-lg border border-border/80 bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <Square className="h-3 w-3 fill-current" />
              Stop
            </button>
          )}

          {(phase === "failed" || phase === "cancelled") && (
            <button
              type="button"
              onClick={() => void resume()}
              className="flex items-center gap-1 rounded-lg bg-[#5551FF] px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-xs"
            >
              <Play className="h-3 w-3 fill-current" />
              Resume
            </button>
          )}

          {!active && (
            <button
              type="button"
              onClick={reset}
              aria-label="Dismiss"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ThreadPanelProps {
  onEdit: (text: string) => void;
  onRetry: (text: string) => void;
}

/** Conversation thread panel — expands smoothly above the composer dock. */
function ThreadPanel({ onEdit, onRetry }: ThreadPanelProps) {
  const thread = useComposerStore((s) => s.thread);
  const open = useComposerStore((s) => s.threadOpen);
  const setOpen = useComposerStore((s) => s.setThreadOpen);
  const clearThread = useComposerStore((s) => s.clearThread);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.length, open]);

  if (thread.length === 0) return null;

  const lastUserPrompt = [...thread].reverse().find((m) => m.role === "user")?.text;

  return (
    <div className="mb-2.5 overflow-hidden rounded-2xl border-2 border-[#5551FF]/40 bg-background/95 shadow-xl shadow-[#5551FF]/15 backdrop-blur-2xl dark:border-[#5551FF]/60 dark:bg-zinc-900/95">
      <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2 text-xs font-medium text-muted-foreground">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 font-semibold text-[#5551FF] hover:opacity-80 transition-opacity cursor-pointer"
        >
          <MessagesSquare className="h-3.5 w-3.5" />
          <span>AI Conversation Thread ({thread.length})</span>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={clearThread}
          className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
        >
          Clear thread
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="max-h-64 space-y-2.5 overflow-y-auto p-3 text-xs"
          >
            {thread.map((msg) => {
              const isError =
                msg.role === "ai" &&
                (msg.text.toLowerCase().includes("failed") ||
                  msg.text.toLowerCase().includes("error") ||
                  msg.text.includes("422"));

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "group relative flex flex-col gap-1",
                    msg.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "relative max-w-[85%] rounded-2xl px-3.5 py-2 leading-relaxed shadow-xs transition-all",
                      msg.role === "user"
                        ? "bg-[#5551FF] text-white font-medium shadow-md shadow-[#5551FF]/20"
                        : isError
                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-medium"
                        : "bg-indigo-50/90 text-foreground border border-indigo-100/80 dark:bg-zinc-800/90 dark:border-zinc-700/50",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                    {/* Controls for User messages */}
                    {msg.role === "user" && (
                      <div className="mt-1 flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onEdit(msg.text)}
                          className="flex items-center gap-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-white/30 transition-colors cursor-pointer"
                          title="Edit prompt in composer"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRetry(msg.text)}
                          className="flex items-center gap-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-white/30 transition-colors cursor-pointer"
                          title="Retry prompt"
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}

                    {/* Action controls for Error messages */}
                    {isError && lastUserPrompt && (
                      <div className="mt-2 flex items-center gap-2 border-t border-rose-500/20 pt-1.5">
                        <button
                          type="button"
                          onClick={() => onRetry(lastUserPrompt)}
                          className="flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-rose-700 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Retry Request</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(lastUserPrompt)}
                          className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-accent transition-colors cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit Prompt</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Sleek, Movable Floating AI Command Dock with Bluish Gradient Glow Shadow.
 * Automatically minimizes if dragged out of or near the window boundaries.
 */
export function AiComposer({ doc }: { doc: DocumentDetail }) {
  const queryClient = useQueryClient();
  const dragControls = useDragControls();
  const dockRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<ComposerTab>("write");
  const [agent, setAgent] = useState<AgentId>("auto");
  const [prompt, setPrompt] = useState("");
  const [minimized, setMinimized] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const start = useGenerationStore((s) => s.start);
  const phase = useGenerationStore((s) => (s.documentId === doc.id ? s.phase : "idle"));
  const running = phase === "connecting" || phase === "planning" || phase === "generating";

  const requestReview = useEditorStore((s) => s.requestReview);
  const activeSectionId = useEditorStore((s) => s.activeSectionId);
  const activeSectionTitle = useEditorStore((s) => s.activeSectionTitle);
  const clearSectionContext = useEditorStore((s) => s.clearSectionContext);

  const focusNonce = useComposerStore((s) => s.focusNonce);
  const push = useComposerStore((s) => s.push);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragControls.start(e);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const margin = 30;

    // Minimize if dragged near or outside window boundaries
    if (
      rect.left < margin ||
      rect.right > windowWidth - margin ||
      rect.top < margin ||
      rect.bottom > windowHeight - margin ||
      info.point.x < margin ||
      info.point.x > windowWidth - margin ||
      info.point.y < margin ||
      info.point.y > windowHeight - margin
    ) {
      setMinimized(true);
    }
  };

  useEffect(() => {
    if (focusNonce > 0) {
      setMinimized(false);
      textareaRef.current?.focus();
    }
  }, [focusNonce]);

  const review = useMutation({
    mutationFn: () => aiApi.review(doc.id),
    onSuccess: (report) => {
      useEditorStore.getState().setReview(doc.id, report);
      requestReview();
      push("ai", `Review complete — overall score ${report.overall_score}/100. Check the Review inspector tab.`);
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : "Review failed";
      push("ai", `Review failed: ${msg}`);
      toast.error(msg);
    },
  });

  const sectionAction = useMutation({
    mutationFn: async ({ action, text }: { action: RefineAction | "regenerate"; text: string }) => {
      const cached = queryClient.getQueryData<DocumentDetail>(["document", doc.id]);
      const section = cached?.sections.find((s) => s.id === activeSectionId);
      if (!section) throw new ApiClientError(0, "no_section", "Focus a section first");
      if (action === "regenerate") {
        return { kind: "regen" as const, section: await aiApi.generateSection(section.id, text) };
      }
      const res = await aiApi.refine(section.id, {
        action,
        selected_text: section.content,
        instruction: text,
      });
      return { kind: "refine" as const, refined: res.refined_text, sectionId: section.id };
    },
    onSuccess: (result) => {
      if (result.kind === "regen") {
        queryClient.setQueryData<DocumentDetail>(["document", doc.id], (old) =>
          old
            ? {
                ...old,
                sections: old.sections.map((s) =>
                  s.id === result.section.id ? { ...s, ...result.section } : s,
                ),
              }
            : old,
        );
        push("ai", `Regenerated "${result.section.title}".`);
      } else {
        queryClient.setQueryData<DocumentDetail>(["document", doc.id], (old) =>
          old
            ? {
                ...old,
                sections: old.sections.map((s) =>
                  s.id === result.sectionId ? { ...s, content: result.refined } : s,
                ),
              }
            : old,
        );
        push("ai", `Updated "${activeSectionTitle ?? "section"}".`);
      }
      void queryClient.invalidateQueries({ queryKey: ["document", doc.id] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : "Action failed";
      push("ai", msg);
      toast.error(msg);
    },
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [prompt]);

  const submit = (textOverride?: string) => {
    const text = (textOverride ?? prompt).trim();
    if (!text || running || sectionAction.isPending) return;

    if (tab === "review") {
      setPrompt("");
      push("user", text);
      push("ai", "Running AI review…");
      review.mutate();
      return;
    }

    setPrompt("");
    push("user", text);
    if (activeSectionId) {
      const action = detectSectionAction(text);
      if (action) {
        sectionAction.mutate({ action, text });
        return;
      }
    }
    void start(doc.id, text, doc.section_count > 0);
  };

  const handleEditPrompt = (text: string) => {
    setPrompt(text);
    setMinimized(false);
    textareaRef.current?.focus();
    toast.info("Prompt loaded into composer for editing");
  };

  const handleRetryPrompt = (text: string) => {
    setMinimized(false);
    submit(text);
  };

  const busy = running || review.isPending || sectionAction.isPending;
  const canSubmit = prompt.trim().length > 0 && !busy;

  if (minimized) {
    return (
      <div className="fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4 pointer-events-none">
        <motion.button
          type="button"
          onClick={() => setMinimized(false)}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="pointer-events-auto flex items-center gap-2.5 rounded-full border-2 border-[#5551FF]/50 bg-background/95 px-4 py-2.5 text-xs font-semibold text-foreground shadow-[0_10px_35px_-5px_rgba(85,81,255,0.35)] backdrop-blur-2xl hover:border-[#5551FF] transition-all"
        >
          <img src="/logo.jpg" alt="Logo" className="h-4 w-4 object-cover rounded-full shrink-0 shadow-xs" />
          <span>AI Assistant</span>
          {running && (
            <span className="flex items-center gap-1 text-[11px] text-[#5551FF]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating…
            </span>
          )}
          <Maximize2 className="h-3.5 w-3.5 opacity-60 ml-1" />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4 pointer-events-none">
      <motion.div
        ref={dockRef}
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0.05}
        onDragEnd={handleDragEnd}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="pointer-events-auto w-full max-w-2xl cursor-default"
      >
        <ThreadPanel onEdit={handleEditPrompt} onRetry={handleRetryPrompt} />

        {/* Floating Command Dock Card with Crisp Uniform Single-Color Outline */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#5551FF]/50 dark:border-[#5551FF]/70 bg-background/95 dark:bg-zinc-950/95 p-3.5 shadow-[0_20px_60px_-10px_rgba(85,81,255,0.3)] dark:shadow-[0_20px_60px_-10px_rgba(85,81,255,0.35)] backdrop-blur-2xl transition-all duration-300">


          {/* Top Header Navigation & Drag Bar */}
          <div className="flex items-center justify-between pb-2 select-none">
            <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-xl border border-border/40">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-150",
                    tab === t.id
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Drag Handle Area — Dragging is strictly triggered here via dragControls */}
            <div
              onPointerDown={handlePointerDown}
              className="flex-1 flex items-center justify-center cursor-grab active:cursor-grabbing px-3 py-1 text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors"
              title="Drag here to move panel"
            >
              <GripHorizontal className="h-4 w-4" />
            </div>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#5551FF] dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300 shadow-xs">
                <img src="/logo.jpg" alt="Logo" className="h-3.5 w-3.5 object-cover rounded-full shrink-0" />
                Gemma 4
              </span>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimize AI Assistant"
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <GenerationStrip />

          {/* Prompt input field */}
          <div className="relative pt-2">
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
                  ? activeSectionTitle
                    ? `Instruct AI for section "${activeSectionTitle}"…`
                    : "Ask AI to draft, rewrite, or structure your document…"
                  : "Specify review criteria or leave blank for a full document review…"
              }
              className="w-full resize-none bg-transparent px-1 text-sm font-normal leading-relaxed outline-none placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Bottom Controls Row */}
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 pt-2.5">
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto py-0.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground hover:border-[#5551FF] transition-all shadow-xs"
                  >
                    <img src="/logo.jpg" alt="Logo" className="h-3.5 w-3.5 object-cover rounded-full shrink-0" />
                    <span>{AGENTS.find((a) => a.id === agent)?.label ?? "Auto"}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" sideOffset={6} className="z-[110] rounded-xl p-1 text-xs shadow-xl">
                  {AGENTS.map((a) => (
                    <DropdownMenuItem key={a.id} onClick={() => setAgent(a.id)} className="cursor-pointer rounded-lg">
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {activeSectionTitle ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#5551FF] px-2.5 py-1 text-xs font-medium text-white shadow-sm shadow-[#5551FF]/25 truncate max-w-[200px]">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{activeSectionTitle}</span>
                  <button
                    type="button"
                    aria-label="Clear section context"
                    onClick={clearSectionContext}
                    className="rounded-full p-0.5 transition-colors hover:bg-white/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 px-1">
                  <FileText className="h-3 w-3" />
                  Whole Document
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => submit()}
              disabled={!canSubmit}
              aria-label="Send"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                canSubmit
                  ? "bg-gradient-to-r from-[#5551FF] to-indigo-600 text-white shadow-md shadow-[#5551FF]/35 hover:scale-105 hover:shadow-lg hover:shadow-[#5551FF]/50 active:scale-95"
                  : "bg-muted/60 text-muted-foreground/40 cursor-not-allowed",
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonal className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}



