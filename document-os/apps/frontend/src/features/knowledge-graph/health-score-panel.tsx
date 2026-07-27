import { Activity, AlertTriangle, CheckCircle, FileText, GitBranch, PieChart, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { healthScoreApi } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { HealthScore } from "@documentos/shared-types";

const METRIC_ICONS: Record<string, typeof FileText> = {
  outdated_docs: FileText,
  test_coverage: Target,
  contradictions: GitBranch,
  duplicate_knowledge: Activity,
  broken_references: AlertTriangle,
  requirement_completeness: PieChart,
};

export function HealthScorePanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["health-score", workspaceId],
    queryFn: () => healthScoreApi.get(workspaceId),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
        <PieChart className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No health data available</p>
      </div>
    );
  }

  const gradeColor = data.grade === "A" ? "text-green-500" : data.grade === "B" ? "text-blue-500" : data.grade === "C" ? "text-amber-500" : data.grade === "D" ? "text-orange-500" : "text-red-500";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Knowledge Health</span>
      </div>

      <ScrollArea className="flex-1 p-3">
        <Card className={`p-4 mb-4 text-center ${gradeColor}`}>
          <div className={`text-4xl font-bold ${gradeColor}`}>{data.grade}</div>
          <div className="text-sm mt-1">{data.overall_score}/100</div>
          <Progress value={data.overall_score} className="mt-2 h-2" />
        </Card>

        <div className="space-y-2">
          {Object.entries(data.metrics).map(([key, metric]) => {
            const Icon = METRIC_ICONS[key] || FileText;
            return (
              <Card key={key} className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${metric.score >= 70 ? "text-green-600" : metric.score >= 50 ? "text-amber-600" : "text-red-600"}`}>
                    {metric.score}/100
                  </span>
                </div>
                <Progress value={metric.score} className="h-1.5"
                  data-state={metric.score >= 70 ? "default" : metric.score >= 50 ? "warning" : "critical"}
                />
                <div className="text-[10px] text-muted-foreground mt-1">
                  {metric.value} {metric.total !== undefined ? `/ ${metric.total}` : ""}
                </div>
              </Card>
            );
          })}
        </div>

        {data.recommendations.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
              <CheckCircle className="h-3 w-3 text-primary" />
              Recommendations
            </h4>
            <div className="space-y-1.5">
              {data.recommendations.map((rec, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-start gap-2 p-2 rounded bg-muted/30">
                  <span className="text-primary mt-0.5">•</span>
                  {rec}
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
