import { Loader2, Sparkles } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useThrottledValue } from "@/hooks/use-throttled-value";
import { useTypewriter } from "@/hooks/use-typewriter";
import { countWords, markdownToHtmlFast } from "@/lib/markdown";

/**
 * Shared rendered-prose container. After innerHTML is set, math spans
 * (`<span data-math data-tex>` produced by the markdown pipeline) are
 * rendered with KaTeX — the same rendering the editor's MathNode produces,
 * so streaming and post-save content look identical.
 *
 * KaTeX is lazy-loaded so bundlers code-split its ~258 KB (gz 50 KB).
 */
function Prose({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [katexLib, setKatexLib] = useState<typeof import("katex") | null>(null);

  useEffect(() => {
    import("katex").then(setKatexLib).catch(() => {});
  }, []);

  const renderMath = useCallback(() => {
    if (!katexLib) return;
    ref.current?.querySelectorAll("span[data-math]").forEach((el) => {
      const tex = el.getAttribute("data-tex") ?? "";
      const display = el.getAttribute("data-display") === "block";
      try {
        katexLib.render(tex, el as HTMLElement, { displayMode: display, throwOnError: false });
      } catch {
        // Leave the raw TeX source visible if KaTeX can't parse it.
      }
    });
  }, [katexLib]);

  useEffect(() => {
    renderMath();
  }, [renderMath, html]);

  return <div ref={ref} className="docos-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

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
  const throttled = useThrottledValue(typed, 120);
  const html = useMemo(() => markdownToHtmlFast(throttled), [throttled]);

  if (!typed) {
    return <span className="text-muted-foreground">Waiting for the first tokens…</span>;
  }
  return (
    <span className="relative">
      <Prose html={html} />
      {showCaret && (
        <span className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse rounded-[1px] bg-primary/70 align-text-bottom" />
      )}
    </span>
  );
});

/**
 * In-place streaming view shown inside a section card while the document
 * pipeline writes that section. Rendered like normal document prose (no box)
 * so the text appears to write itself directly into the document.
 */
export function StreamingBody({ tokens }: { tokens: string }) {
  const typed = useTypewriter(tokens);
  const throttled = useThrottledValue(typed, 120);
  const html = useMemo(() => markdownToHtmlFast(throttled), [throttled]);

  return (
    <div className="relative my-3 flex flex-col overflow-hidden rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-white/95 dark:bg-zinc-950/95 p-4 shadow-sm shadow-indigo-500/5 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between border-b border-indigo-100/80 dark:border-indigo-950/80 pb-2.5">
        <span className="flex items-center gap-2 text-xs font-semibold text-[#5551FF] dark:text-indigo-400">
          <Loader2 className="h-4 w-4 animate-spin text-[#5551FF]" />
          AI is writing…
        </span>
      </div>
      {typed ? (
        <div className="relative py-1">
          <Prose html={html} />
          <span className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse rounded-[1px] bg-[#5551FF] align-text-bottom" />
        </div>
      ) : (
        <div className="space-y-2 py-1">
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>
      )}
    </div>
  );
}

/** Placeholder skeleton for sections queued in the current generation run. */
export function QueuedBody() {
  return (
    <div className="space-y-2 px-1 py-2 opacity-70">
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}
