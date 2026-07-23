import { Sparkles } from "lucide-react";
import { memo, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTypewriter } from "@/hooks/use-typewriter";
import { countWords, markdownToHtmlFast } from "@/lib/markdown";

/**
 * Progressively-rendered streamed markdown with typewriter pacing.
 * Used by the document pipeline (StreamingBody) and single-section regen
 * (StreamOverlay) so both feel like the AI is visibly writing a real
 * document — not dumping raw markdown into a console.
 */
export const StreamedMarkdown = memo(function StreamedMarkdown({
  tokens,
  showCaret = true,
}: {
  tokens: string;
  showCaret?: boolean;
}) {
  const typed = useTypewriter(tokens);
  const html = useMemo(() => markdownToHtmlFast(typed), [typed]);

  if (!typed) {
    return <span className="text-muted-foreground">Waiting for the first tokens…</span>;
  }
  return (
    <span className="relative">
      <span className="docos-prose" dangerouslySetInnerHTML={{ __html: html }} />
      {showCaret && (
        <span className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse rounded-[1px] bg-primary/70 align-text-bottom" />
      )}
    </span>
  );
});

/** Live word count for streamed text (typewriter-paced). */
export function useStreamWordCount(tokens: string): number {
  const typed = useTypewriter(tokens);
  return useMemo(() => countWords(typed), [typed]);
}

/**
 * In-place streaming view shown inside a section card while the document
 * pipeline writes that section.
 */
export function StreamingBody({ tokens }: { tokens: string }) {
  const typed = useTypewriter(tokens);
  const html = useMemo(() => markdownToHtmlFast(typed), [typed]);
  const words = useMemo(() => countWords(typed), [typed]);

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/[0.03] px-4 py-3 transition-colors">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3 animate-pulse" />
          AI is writing…
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {words.toLocaleString()} words
        </span>
      </div>
      {typed ? (
        <div className="relative">
          <div className="docos-prose" dangerouslySetInnerHTML={{ __html: html }} />
          <span className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse rounded-[1px] bg-primary/70 align-text-bottom" />
        </div>
      ) : (
        <div className="space-y-2 py-1">
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
          <p className="text-xs text-muted-foreground">Waiting for the first tokens…</p>
        </div>
      )}
    </div>
  );
}

/** Placeholder skeleton for sections queued in the current generation run. */
export function QueuedBody() {
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border/70 px-4 py-3">
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}
