import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, Lightbulb, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ApiClientError, aiApi } from "@/lib/api-client";
import { useEditorStore } from "@/features/editor/editor-store";

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(Math.max(score, 0), 100) / 100)}
          className={`${scoreColor(score)} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-semibold ${scoreColor(score)}`}>{Math.round(score)}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">overall</span>
      </div>
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

export function ReviewTab({ documentId }: { documentId: string }) {
  const queryClient = useQueryClient();
  const report = useEditorStore((s) => s.reviews[documentId]);
  const setReview = useEditorStore((s) => s.setReview);
  const runId = useEditorStore((s) => s.reviewRunId);
  const lastRunRef = useRef(0);

  const run = useMutation({
    mutationFn: () => aiApi.review(documentId),
    onSuccess: (result) => {
      setReview(documentId, result);
      void queryClient.invalidateQueries({ queryKey: ["activity", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Review failed"),
  });

  useEffect(() => {
    if (runId > lastRunRef.current) {
      lastRunRef.current = runId;
      run.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return (
    <div className="space-y-4 p-3">
      <Button
        size="sm"
        variant={report ? "outline" : "default"}
        className="w-full"
        onClick={() => run.mutate()}
        disabled={run.isPending}
      >
        {run.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ClipboardCheck className="h-4 w-4" />
        )}
        {run.isPending ? "Reviewing…" : report ? "Re-run review" : "Run review"}
      </Button>

      {!report && !run.isPending && (
        <EmptyState
          icon={ClipboardCheck}
          title="No review yet"
          hint="The Reviewer scores readability, completeness and confidence."
        />
      )}

      {report && (
        <>
          <div className="flex justify-center py-1">
            <ScoreRing score={report.overall_score} />
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">{report.summary}</p>
          <div className="space-y-2.5">
            <MetricBar label="Readability" value={report.readability} />
            <MetricBar label="Completeness" value={report.completeness} />
            <MetricBar label="Confidence" value={report.confidence} />
          </div>
          {report.strengths.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium">Strengths</p>
              <ul className="space-y-1">
                {report.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.suggestions.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium">Suggestions</p>
              <ul className="space-y-1">
                {report.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
