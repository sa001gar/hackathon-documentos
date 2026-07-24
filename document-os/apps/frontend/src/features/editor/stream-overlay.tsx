import { Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StreamedMarkdown } from "./streaming-body";

/** Live token preview shown over a section body while SSE generation runs. */
export function StreamOverlay({ tokens, onStop }: { tokens: string; onStop: () => void }) {
  return (
    <div className="relative my-3 flex flex-col overflow-hidden rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-white/95 dark:bg-zinc-950/95 p-4 shadow-sm shadow-indigo-500/5 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between border-b border-indigo-100/80 dark:border-indigo-950/80 pb-2.5">
        <span className="flex items-center gap-2 text-xs font-semibold text-[#5551FF] dark:text-indigo-400">
          <Loader2 className="h-4 w-4 animate-spin text-[#5551FF]" />
          AI is writing…
        </span>
        <button
          type="button"
          onClick={onStop}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-200 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-sm"
        >
          <Square className="h-3 w-3 fill-current text-slate-700 dark:text-zinc-200" />
          Stop
        </button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="py-1">
          <StreamedMarkdown tokens={tokens} />
        </div>
      </ScrollArea>
    </div>
  );
}
