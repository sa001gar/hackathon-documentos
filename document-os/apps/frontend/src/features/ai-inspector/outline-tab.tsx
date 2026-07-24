import { cn } from "@documentos/utils";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock, ListTree, XCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusDot, SECTION_DOT_COLORS } from "@/components/status";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentTree } from "@/hooks/use-document-tree";
import { documentApi } from "@/lib/api-client";
import { useEditorStore } from "@/features/editor/editor-store";
import { useGenerationStore } from "@/features/editor/generation-store";

export function OutlineTab({ documentId }: { documentId: string }) {
  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentApi.get(documentId),
  });
  const { flat } = useDocumentTree(doc);
  const setScrollTarget = useEditorStore((s) => s.setScrollTarget);

  // Live pipeline state. statusBySection only gets a new reference when a
  // status flips (never per token), so this selector is safe and cheap.
  const genStatusById = useGenerationStore((s) => s.statusBySection);
  const currentSectionId = useGenerationStore((s) => s.currentSectionId);
  const phase = useGenerationStore((s) => (s.documentId === documentId ? s.phase : "idle"));
  const total = useGenerationStore((s) => s.totalSections);
  const completed = useGenerationStore((s) => s.completedCount);
  const active = phase === "planning" || phase === "generating" || phase === "connecting";

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
      {active && (
        <div className="mb-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium">
              {phase === "planning" || phase === "connecting" ? "Planning…" : "Generating…"}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {completed}/{total}
            </span>
          </div>
          <Progress value={total > 0 ? (completed / total) * 100 : 5} className="h-1.5" />
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
          {flat.map(({ node, depth }) => {
            const genStatus = genStatusById[node.id];
            const isCurrent = node.id === currentSectionId;
            return (
              <button
                key={node.id}
                onClick={() => setScrollTarget(node.id)}
                style={{ paddingLeft: 8 + depth * 14 }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[13px] transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isCurrent && "bg-[#5551FF]/10 text-[#5551FF] font-semibold border-l-2 border-[#5551FF] rounded-r-lg shadow-sm",
                )}
              >
                {genStatus === "completed" ? (
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                ) : genStatus === "failed" ? (
                  <XCircle className="h-3 w-3 shrink-0 text-destructive" />
                ) : genStatus === "generating" ? (
                  <StatusDot
                    status="generating"
                    map={SECTION_DOT_COLORS}
                    pulse
                    className="h-1.5 w-1.5"
                  />
                ) : genStatus === "queued" ? (
                  <Clock className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                ) : (
                  <StatusDot
                    status={node.status}
                    map={SECTION_DOT_COLORS}
                    pulse={node.status === "generating"}
                    className="h-1.5 w-1.5"
                  />
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    isCurrent && "font-semibold text-[#5551FF]",
                  )}
                >
                  {node.title}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground/60">
                  {node.word_count > 0 ? node.word_count : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
