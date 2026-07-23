import { cn, formatRelativeTime } from "@documentos/utils";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { documentApi } from "@/lib/api-client";

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

export function ActivityTab({ documentId }: { documentId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["activity", documentId],
    queryFn: () => documentApi.activity(documentId),
  });

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

  if (!data?.length) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        hint="Agent runs — planning, writing, refining, validating — show up here."
      />
    );
  }

  return (
    <div className="space-y-1 p-2">
      {data.map((entry) => (
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
  );
}
