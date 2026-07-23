import type { ValidationIssue } from "@documentos/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Info, Lightbulb, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError, aiApi, documentApi } from "@/lib/api-client";
import { useEditorStore } from "@/features/editor/editor-store";

const SEVERITY_ORDER = ["error", "warning", "info"] as const;

const SEVERITY_CONFIG = {
  error: { icon: AlertCircle, className: "text-red-400", label: "Errors" },
  warning: { icon: AlertTriangle, className: "text-amber-400", label: "Warnings" },
  info: { icon: Info, className: "text-sky-400", label: "Info" },
} as const;

function IssueCard({
  issue,
  sectionTitle,
  onGoTo,
}: {
  issue: ValidationIssue;
  sectionTitle: string | null;
  onGoTo: (sectionId: string) => void;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <div className="mb-1 flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] capitalize">
          {issue.type.replace(/_/g, " ")}
        </Badge>
        {sectionTitle && (
          <button
            onClick={() => issue.section_id && onGoTo(issue.section_id)}
            className="truncate text-[11px] text-primary hover:underline focus-visible:outline-none"
          >
            {sectionTitle}
          </button>
        )}
      </div>
      <p className="text-xs leading-relaxed">{issue.message}</p>
      {issue.suggestion && (
        <p className="mt-1 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
          {issue.suggestion}
        </p>
      )}
    </div>
  );
}

export function ValidateTab({ documentId }: { documentId: string }) {
  const queryClient = useQueryClient();
  const report = useEditorStore((s) => s.validations[documentId]);
  const setValidation = useEditorStore((s) => s.setValidation);
  const setScrollTarget = useEditorStore((s) => s.setScrollTarget);
  const runId = useEditorStore((s) => s.validateRunId);
  const lastRunRef = useRef(0);

  const { data: doc } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentApi.get(documentId),
  });
  const sectionTitles = useMemo(
    () => new Map((doc?.sections ?? []).map((s) => [s.id, s.title])),
    [doc?.sections],
  );

  const run = useMutation({
    mutationFn: () => aiApi.validate(documentId),
    onSuccess: (result) => {
      setValidation(documentId, result);
      void queryClient.invalidateQueries({ queryKey: ["activity", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Validation failed"),
  });

  // Header / palette "Validate" buttons trigger a run via the store nonce.
  useEffect(() => {
    if (runId > lastRunRef.current) {
      lastRunRef.current = runId;
      run.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const grouped = useMemo(() => {
    if (!report) return [];
    return SEVERITY_ORDER.map((severity) => ({
      severity,
      issues: report.issues.filter((i) => i.severity === severity),
    })).filter((g) => g.issues.length > 0);
  }, [report]);

  return (
    <div className="space-y-3 p-3">
      <Button
        size="sm"
        variant={report ? "outline" : "default"}
        className="w-full"
        onClick={() => run.mutate()}
        disabled={run.isPending}
      >
        {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {run.isPending ? "Validating…" : report ? "Re-run validation" : "Run validation"}
      </Button>

      {!report && !run.isPending && (
        <EmptyState
          icon={ShieldCheck}
          title="No validation yet"
          hint="The Validator checks structure, terminology, duplicates and references."
        />
      )}

      {report && (
        <>
          <div className="flex items-center gap-2">
            <Badge variant={report.is_valid ? "success" : "destructive"}>
              {report.is_valid ? "Valid" : "Issues found"}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {report.issues.length} {report.issues.length === 1 ? "issue" : "issues"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{report.summary}</p>
          {grouped.map(({ severity, issues }) => {
            const cfg = SEVERITY_CONFIG[severity];
            const Icon = cfg.icon;
            return (
              <div key={severity}>
                <p className={`mb-1.5 flex items-center gap-1.5 text-xs font-medium ${cfg.className}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label} ({issues.length})
                </p>
                <div className="space-y-1.5">
                  {issues.map((issue, i) => (
                    <IssueCard
                      key={i}
                      issue={issue}
                      sectionTitle={issue.section_id ? (sectionTitles.get(issue.section_id) ?? null) : null}
                      onGoTo={setScrollTarget}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
