import { cn } from "@documentos/utils";
import { CheckCircle2, Loader2, Play, WandSparkles, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGenerationStore, type GenPhase } from "./generation-store";

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Ticking clock that only runs while `active` is true. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const LABELS: Record<GenPhase, string> = {
  idle: "",
  connecting: "Connecting…",
  planning: "Planning outline…",
  generating: "Generating document",
  completed: "Generation complete",
  failed: "Generation failed",
  cancelled: "Generation cancelled",
};

/**
 * Sticky bottom bar with live generation stats: counts, current section,
 * elapsed/estimated time, and cancel / resume / dismiss controls.
 */
export function GenerationProgress({ documentId }: { documentId: string }) {
  const phase = useGenerationStore((s) => (s.documentId === documentId ? s.phase : "idle"));
  const total = useGenerationStore((s) => s.totalSections);
  const completed = useGenerationStore((s) => s.completedCount);
  const failed = useGenerationStore((s) => s.failedCount);
  const startedAt = useGenerationStore((s) => s.startedAt);
  const error = useGenerationStore((s) => s.error);
  const currentTitle = useGenerationStore(
    (s) => s.sections.find((x) => x.id === s.currentSectionId)?.title ?? null,
  );
  const cancel = useGenerationStore((s) => s.cancel);
  const resume = useGenerationStore((s) => s.resume);
  const reset = useGenerationStore((s) => s.reset);

  const active = phase === "connecting" || phase === "planning" || phase === "generating";
  const now = useNow(active);
  const elapsed = startedAt ? now - startedAt : 0;
  const remaining = total - completed;
  const eta = active && completed > 0 && remaining > 0 ? (elapsed / completed) * remaining : null;
  const pct = total > 0 ? (completed / total) * 100 : active ? 5 : 100;

  if (phase === "idle") return null;

  return (
    <div className="sticky bottom-3 z-20 mt-4 rounded-lg border border-border bg-popover/95 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-3 px-3 pt-2.5">
        {active ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : phase === "completed" ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-medium">
              {LABELS[phase]}
              {currentTitle && active && (
                <span className="text-muted-foreground"> — {currentTitle}</span>
              )}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {completed}/{total} sections
              {failed > 0 && <span className="text-destructive"> · {failed} failed</span>}
              {startedAt && <> · {formatDuration(elapsed)}</>}
              {eta !== null && <> · ~{formatDuration(eta)} left</>}
            </span>
          </div>
          {(phase === "failed" || phase === "cancelled") && error && (
            <p className="mt-0.5 truncate text-[11px] text-destructive">{error}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {active && (
            <Button size="xs" variant="ghost" onClick={cancel}>
              <X className="h-3 w-3" />
              Stop
            </Button>
          )}
          {(phase === "failed" || phase === "cancelled") && (
            <Button size="xs" variant="outline" onClick={() => void resume()}>
              <Play className="h-3 w-3" />
              Resume
            </Button>
          )}
          {!active && (
            <Button size="xs" variant="ghost" onClick={reset}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
      <div className="px-3 pb-2.5 pt-2">
        <Progress
          value={pct}
          className={cn("h-1.5 transition-all", phase === "failed" && "[&>div]:bg-destructive")}
        />
      </div>
    </div>
  );
}

/** Small sparkle icon shown in the editor header while generation runs. */
export function GeneratingIndicator({ documentId }: { documentId: string }) {
  const active = useGenerationStore(
    (s) =>
      s.documentId === documentId &&
      (s.phase === "connecting" || s.phase === "planning" || s.phase === "generating"),
  );
  if (!active) return null;
  return <WandSparkles className="h-3.5 w-3.5 animate-pulse text-primary" aria-label="Generating" />;
}
