import { cn, formatRelativeTime } from "@documentos/utils";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { documentApi } from "@/lib/api-client";
import { useGenerationStore } from "@/features/editor/generation-store";

const AGENT_COLORS: Record<string, string> = {
  planner: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  writer: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  refiner: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  validator: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  reviewer: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  exporter: "bg-pink-500/15 text-pink-400 border-pink-500/30",
};

function statusDot(status: string): string {
  const s = status.toLowerCase();
  if (s === "success" || s === "completed" || s === "ok") return "bg-emerald-400";
  if (s === "error" || s === "failed") return "bg-red-400";
  if (s === "running" || s === "pending") return "bg-indigo-400";
  return "bg-zinc-400";
}

/** Live feed of the in-progress (or most recent) generation run. */
function LiveFeed() {
  const activity = useGenerationStore((s) => s.activity);
  const phase = useGenerationStore((s) => s.phase);
  const active = phase === "connecting" || phase === "planning" || phase === "generating";
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest event visible.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activity.length]);

  if (activity.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {active && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        Live session
      </div>
      <div className="space-y-0.5">
        {activity.map((item, i) => {
          const isLast = i === activity.length - 1;
          const spinning = active && isLast && item.kind === "info";
          return (
            <div
              key={item.id}
              className="flex items-start gap-2 rounded-md px-2 py-1 text-xs hover:bg-accent/60"
            >
              {spinning ? (
                <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-primary" />
              ) : item.kind === "success" ? (
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
              ) : item.kind === "error" ? (
                <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
              ) : (
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/60" />
              )}
              <span className={cn("min-w-0 flex-1", item.kind === "error" && "text-destructive")}>
                {item.message}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground/60">
                {formatRelativeTime(new Date(item.at).toISOString())}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="mx-2 my-2 border-t border-border/50" />
      <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        History
      </div>
    </div>
  );
}

export function ActivityTab({ documentId }: { documentId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["activity", documentId],
    queryFn: () => documentApi.activity(documentId),
  });
  const hasLive = useGenerationStore((s) => s.activity.length > 0);

  if (isLoading) {
    return (
      <div className="space-y-3 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Could not load activity." onRetry={() => void refetch()} />;
  }

  return (
    <div className="p-2">
      <LiveFeed />
      {!data?.length && !hasLive ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          hint="Agent runs — planning, writing, refining, validating — show up here."
        />
      ) : (
        <div className="space-y-1">
          {data?.map((entry) => (
            <div key={entry.id} className="rounded-md px-2 py-1.5 hover:bg-accent/60">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px] capitalize",
                    AGENT_COLORS[entry.agent.toLowerCase()] ??
                      "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
                  )}
                >
                  {entry.agent}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-xs">{entry.action}</span>
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot(entry.status))} />
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 pl-1">
                <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground/70">
                  {entry.detail ?? ""}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground/70">
                  {formatRelativeTime(entry.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
