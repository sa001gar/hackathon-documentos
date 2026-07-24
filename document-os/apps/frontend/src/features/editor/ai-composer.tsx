import type { DocumentDetail, RefineAction } from "@documentos/shared-types";
import { cn } from "@documentos/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Maximize2,
  MessagesSquare,
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
          {total > 0 && (
            <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/40">
              {completed}/{total} {failed > 0 && <span className="text-destructive">({failed} failed)</span>}
            </span>
          )}

          {active && (
            <button
              type="button"
              onClick={cancel}
              className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/90 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground shadow-xs"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          )}

          {(phase === "failed" || phase === "cancelled") && (
            <button
              type="button"
              onClick={() => void resume()}
              className="flex items-center gap-1 rounded-lg bg-[#5551FF] px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 shadow-xs"
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
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Conversation thread panel — expands smoothly above the composer dock. */
function ThreadPanel() {
  const thread = useComposerStore((s) => s.thread);
  const open = useComposerStore((s) => s.threadOpen);
  const setOpen = useComposerStore((s) => s.setThreadOpen);
  const clearThread = useComposerStore((s) => s.clearThread);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.length, open]);

  if (thread.length === 0) return null;

  return (
    <div className="mb-2.5 overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-xl backdrop-blur-2xl dark:bg-zinc-900/95">
      <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2 text-xs font-medium text-muted-foreground">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 font-semibold text-[#5551FF] hover:opacity-80"
        >
          <MessagesSquare className="h-3.5 w-3.5" />
          <span>AI Conversation Thread ({thread.length})</span>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={clearThread}
          className="text-[11px] text-muted-foreground/70 hover:text-foreground"
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
            className="max-h-60 space-y-2.5 overflow-y-auto p-3 text-xs"
          >
            {thread.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 leading-relaxed shadow-xs",
                    msg.role === "user"
                      ? "bg-[#5551FF] text-white font-medium"
                      : "bg-indigo-50/90 text-foreground border border-indigo-100/80 dark:bg-zinc-800/90 dark:border-zinc-700/50",
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Sleek, Floating AI Command Dock (Cursor / Notion AI inspired).
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
  const activeSectionId = useEditorStore((s) => s.activeSectionId);
  const activeSectionTitle = useEditorStore((s) => s.activeSectionTitle);
  const clearSectionContext = useEditorStore((s) => s.clearSectionContext);

  const focusNonce = useComposerStore((s) => s.focusNonce);
  const push = useComposerStore((s) => s.push);

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

  const submit = () => {
    const text = prompt.trim();
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
          className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-indigo-500/30 bg-background/95 px-4 py-2.5 text-xs font-semibold text-foreground shadow-2xl shadow-indigo-500/20 backdrop-blur-2xl hover:border-[#5551FF] transition-all"
        >
          <Sparkles className="h-4 w-4 text-[#5551FF] animate-pulse" />
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
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="pointer-events-auto w-full max-w-2xl"
      >
        <ThreadPanel />

        {/* Floating Command Dock Card */}
        <div className="overflow-hidden rounded-2xl border border-indigo-500/30 bg-background/90 p-3 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl dark:border-indigo-500/40 dark:bg-zinc-950/90">
          {/* Top header navigation */}
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-xl border border-border/40">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-semibold transition-all",
                    tab === t.id
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#5551FF] dark:bg-indigo-500/20 dark:text-indigo-300">
                <Sparkles className="h-3 w-3" />
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
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 pt-2">
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground hover:border-[#5551FF] transition-all shadow-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#5551FF]" />
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
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#5551FF] px-2.5 py-1 text-xs font-medium text-white shadow-xs truncate max-w-[200px]">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{activeSectionTitle}</span>
                  <button
                    type="button"
                    aria-label="Clear section context"
                    onClick={clearSectionContext}
                    className="rounded-full p-0.5 hover:bg-white/20"
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
              onClick={submit}
              disabled={!canSubmit}
              aria-label="Send"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                canSubmit
                  ? "bg-[#5551FF] text-white shadow-md shadow-[#5551FF]/20 hover:scale-105 hover:bg-[#4540FF] active:scale-95"
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
