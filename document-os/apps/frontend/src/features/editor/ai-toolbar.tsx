import type { RefineAction } from "@documentos/shared-types";
import { cn } from "@documentos/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Briefcase,
  CheckCheck,
  GraduationCap,
  Languages,
  Loader2,
  MessageSquareHeart,
  PenLine,
  Play,
  Scale,
  Scissors,
  Wand2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PencilSparkles } from "@/components/ui/pencil-sparkles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApiClientError, aiApi } from "@/lib/api-client";

interface ToolbarAction {
  action: RefineAction;
  label: string;
  icon: typeof PencilSparkles;
}

const ACTION_GROUPS: ToolbarAction[][] = [
  [
    { action: "improve", label: "Improve", icon: PencilSparkles },
    { action: "rewrite", label: "Rewrite", icon: PenLine },
    { action: "expand", label: "Expand", icon: ArrowUpWideNarrow },
    { action: "shorten", label: "Shorten", icon: ArrowDownWideNarrow },
  ],
  [
    { action: "professional", label: "Professional", icon: Briefcase },
    { action: "friendly", label: "Friendly", icon: MessageSquareHeart },
    { action: "academic", label: "Academic", icon: GraduationCap },
    { action: "legal", label: "Legal", icon: Scale },
  ],
  [
    { action: "fix_grammar", label: "Fix grammar", icon: CheckCheck },
    { action: "summarize", label: "Summarize", icon: Scissors },
    { action: "continue", label: "Continue", icon: Play },
  ],
];

interface AiToolbarProps {
  editor: Editor;
  sectionId: string;
  documentId?: string;
  /** Called after the AI edit is applied so the host can persist. */
  onApplied: () => void;
}

export function AiToolbar({ editor, sectionId, documentId, onApplied }: AiToolbarProps) {
  const queryClient = useQueryClient();
  // Selection captured at click time so async replacement targets the right range.
  const selectionRef = useRef<{ from: number; to: number; text: string } | null>(null);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [language, setLanguage] = useState("Spanish");

  const mutation = useMutation({
    mutationFn: (vars: { action: RefineAction; instruction?: string }) => {
      const sel = selectionRef.current;
      if (!sel) return Promise.reject(new Error("No selection"));
      return aiApi.refine(sectionId, {
        action: vars.action,
        selected_text: sel.text,
        instruction: vars.instruction,
      });
    },
    onSuccess: (data, vars) => {
      const sel = selectionRef.current;
      if (!sel) return;
      // "Continue" appends after the selection; everything else replaces it.
      const range =
        vars.action === "continue" ? { from: sel.to, to: sel.to } : { from: sel.from, to: sel.to };
      editor.chain().focus().insertContentAt(range, data.refined_text).run();
      onApplied();
      if (documentId) {
        void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
        void queryClient.invalidateQueries({ queryKey: ["documents"] });
      }
      toast.success(`AI "${vars.action.replace("_", " ")}" applied`);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "AI refine failed"),
  });

  const captureSelection = () => {
    const { from, to } = editor.state.selection;
    selectionRef.current = {
      from,
      to,
      text: editor.state.doc.textBetween(from, to, " ", " "),
    };
  };

  const run = (action: RefineAction, instruction?: string) => {
    captureSelection();
    mutation.mutate({ action, instruction });
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={`ai-toolbar-${sectionId}`}
      updateDelay={120}
      tippyOptions={{
        duration: 120,
        maxWidth: "none",
        placement: "top-start",
        offset: [0, 8],
      }}
      shouldShow={({ editor: e, state, from, to }) => {
        if (from === to) return false;
        if (e.isActive("codeBlock") || e.isActive("image")) return false;
        return state.doc.textBetween(from, to, " ", " ").trim().length > 0;
      }}
    >
      <div
        className="flex max-w-[540px] flex-col overflow-hidden rounded-2xl border-2 border-[#5551FF]/50 bg-popover/95 p-1.5 shadow-[0_15px_40px_-5px_rgba(85,81,255,0.25)] backdrop-blur-2xl dark:border-[#5551FF]/70"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-wrap items-center gap-0.5">
          {ACTION_GROUPS.map((group, gi) => (
            <div key={gi} className="flex items-center gap-0.5">
              {gi > 0 && <span className="mx-1 h-4 w-px bg-border/60" aria-hidden />}
              {group.map(({ action, label, icon: Icon }) => {
                const pending = mutation.isPending && mutation.variables?.action === action;
                return (
                  <Button
                    key={action}
                    size="xs"
                    variant="ghost"
                    disabled={mutation.isPending}
                    onClick={() => run(action)}
                    className={cn(
                      "transition-all duration-150",
                      pending && "bg-[#5551FF]/15 text-[#5551FF] border border-[#5551FF]/40 font-semibold shadow-xs dark:bg-indigo-500/25 dark:text-indigo-300",
                    )}
                  >
                    {pending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5551FF]" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    {label}
                  </Button>
                );
              })}
              {gi === ACTION_GROUPS.length - 1 && (
                <Popover open={translateOpen} onOpenChange={setTranslateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={mutation.isPending}
                      onClick={() => captureSelection()}
                      className={cn(
                        mutation.isPending && mutation.variables?.action === "translate" && "bg-[#5551FF]/15 text-[#5551FF] font-semibold",
                      )}
                    >
                      {mutation.isPending && mutation.variables?.action === "translate" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5551FF]" />
                      ) : (
                        <Languages className="h-3.5 w-3.5" />
                      )}
                      Translate
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52" align="start">
                    <div className="space-y-2">
                      <p className="text-xs font-medium">Translate selection into</p>
                      <Input
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && language.trim()) {
                            setTranslateOpen(false);
                            run("translate", `Translate to ${language.trim()}`);
                          }
                        }}
                        placeholder="Language"
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={!language.trim() || mutation.isPending}
                        onClick={() => {
                          setTranslateOpen(false);
                          run("translate", `Translate to ${language.trim()}`);
                        }}
                      >
                        {mutation.isPending && mutation.variables?.action === "translate" && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Translate
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          ))}
          {mutation.isPending && (
            <Wand2 className="ml-1 h-3.5 w-3.5 animate-pulse text-[#5551FF]" aria-hidden />
          )}
        </div>

        {/* Live Progression Banner during processing */}
        {mutation.isPending && (
          <div className="mt-1 flex w-full items-center justify-between gap-2 border-t border-indigo-500/20 bg-indigo-50/90 dark:bg-indigo-950/80 px-2.5 py-1 text-[11px] font-semibold text-[#5551FF] dark:text-indigo-300 rounded-b-lg">
            <span className="flex items-center gap-1.5 truncate">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-[#5551FF]" />
              <span className="truncate">
                AI processing: <span className="capitalize">{mutation.variables?.action.replace("_", " ") ?? "refining"}</span>…
              </span>
            </span>
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-[#5551FF] animate-ping" />
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}

