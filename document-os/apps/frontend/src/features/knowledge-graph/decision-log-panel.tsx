import { BookOpen, CheckCircle, Clock, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { decisionApi } from "@/lib/api-client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Decision } from "@documentos/shared-types";

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string }> = {
  approved: { icon: CheckCircle, color: "text-green-600 bg-green-50 dark:bg-green-950" },
  proposed: { icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-950" },
  rejected: { icon: XCircle, color: "text-red-600 bg-red-50 dark:bg-red-950" },
  deprecated: { icon: XCircle, color: "text-slate-500 bg-slate-50 dark:bg-slate-900" },
  superseded: { icon: BookOpen, color: "text-purple-600 bg-purple-50 dark:bg-purple-950" },
};

export function DecisionLogPanel({}: { projectId?: string; workspaceId?: string } = {}) {
  const { data: decisions, isLoading } = useQuery({
    queryKey: ["decisions"],
    queryFn: () => decisionApi.search(""),
    enabled: false,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (!decisions || decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
        <BookOpen className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No decisions recorded</p>
        <p className="text-xs mt-1">Architectural decisions will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b">
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decisions Log</span>
        <Badge variant="outline" className="ml-auto text-[10px]">{decisions.length}</Badge>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {decisions.map(d => {
            const config = STATUS_CONFIG[d.status] || STATUS_CONFIG.proposed;
            const Icon = config.icon;
            return (
              <div key={d.id} className={`p-3 rounded-lg border ${config.color}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs font-semibold truncate">{d.title}</span>
                    </div>
                    <p className="text-[10px] mt-1 opacity-70 line-clamp-2">{d.decision.slice(0, 150)}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] h-4 shrink-0">{d.status}</Badge>
                </div>
                {d.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {d.tags.map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-background/50">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-[9px] opacity-50">
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>by {d.created_by.slice(0, 8)}</span>
                  {d.risks.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{d.risks.length} risks</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
