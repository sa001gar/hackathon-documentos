import { useQuery } from "@tanstack/react-query";
import { ListTree } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusDot, SECTION_DOT_COLORS } from "@/components/status";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentTree } from "@/hooks/use-document-tree";
import { useGenerationJob } from "@/hooks/use-generation-job";
import { documentApi } from "@/lib/api-client";
import { useEditorStore } from "@/features/editor/editor-store";

export function OutlineTab({ documentId }: { documentId: string }) {
  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentApi.get(documentId),
  });
  const { flat } = useDocumentTree(doc);
  const jobId = useEditorStore((s) => s.jobId);
  const setScrollTarget = useEditorStore((s) => s.setScrollTarget);
  const { job, active } = useGenerationJob(jobId, documentId);

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" style={{ width: `${90 - i * 8}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-2">
      {job && (active || job.status === "completed") && (
        <div className="mb-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium">{active ? "Generating…" : "Generation complete"}</span>
            <span className="text-muted-foreground">
              {job.completed_sections}/{job.total_sections}
            </span>
          </div>
          <Progress
            value={job.total_sections > 0 ? (job.completed_sections / job.total_sections) * 100 : 0}
            className="h-1.5"
          />
        </div>
      )}
      {flat.length === 0 ? (
        <EmptyState
          icon={ListTree}
          title="No sections yet"
          hint="The outline fills in as sections are added or generated."
        />
      ) : (
        <div className="space-y-0.5">
          {flat.map(({ node, depth }) => (
            <button
              key={node.id}
              onClick={() => setScrollTarget(node.id)}
              style={{ paddingLeft: 8 + depth * 14 }}
              className="flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[13px] hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <StatusDot
                status={node.status}
                map={SECTION_DOT_COLORS}
                pulse={node.status === "generating"}
                className="h-1.5 w-1.5"
              />
              <span className="min-w-0 flex-1 truncate">{node.title}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground/60">
                {node.word_count > 0 ? node.word_count : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
