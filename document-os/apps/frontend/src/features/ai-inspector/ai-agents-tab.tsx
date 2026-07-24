import { cn } from "@documentos/utils";
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Loader2,
  PenLine,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useGenerationStore, type GenPhase } from "@/features/editor/generation-store";

type AgentStatus = "idle" | "running" | "completed" | "failed" | "pending";

interface AgentRow {
  name: string;
  role: string;
  icon: typeof Bot;
  status: AgentStatus;
  detail?: string;
}

const STATUS_STYLE: Record<AgentStatus, { dot: string; label: string; spin?: boolean }> = {
  idle: { dot: "bg-zinc-400", label: "Idle" },
  pending: { dot: "bg-amber-400", label: "Pending" },
  running: { dot: "bg-indigo-400", label: "Working", spin: true },
  completed: { dot: "bg-emerald-400", label: "Done" },
  failed: { dot: "bg-red-400", label: "Failed" },
};

function plannerStatus(phase: GenPhase): AgentStatus {
  if (phase === "planning" || phase === "connecting") return "running";
  if (phase === "generating" || phase === "completed") return "completed";
  if (phase === "failed" || phase === "cancelled") return "failed";
  return "idle";
}

function writerStatus(phase: GenPhase, completed: number, total: number): AgentStatus {
  if (phase === "generating") return "running";
  if (phase === "completed") return completed > 0 ? "completed" : "idle";
  if (phase === "failed" || phase === "cancelled") return completed > 0 ? "failed" : "idle";
  if (phase === "planning" || phase === "connecting") return total > 0 ? "pending" : "idle";
  return "idle";
}

/** Live view of the AI team: who is working, on what, and how far along. */
export function AiAgentsTab({ documentId }: { documentId: string }) {
  const phase = useGenerationStore((s) => (s.documentId === documentId ? s.phase : "idle"));
  const total = useGenerationStore((s) => s.totalSections);
  const completed = useGenerationStore((s) => s.completedCount);
  const failed = useGenerationStore((s) => s.failedCount);
  const currentTitle = useGenerationStore(
    (s) => s.sections.find((x) => x.id === s.currentSectionId)?.title ?? null,
  );

  const active = phase === "connecting" || phase === "planning" || phase === "generating";

  const agents: AgentRow[] = [
    {
      name: "Planner",
      role: "Outlines the document structure",
      icon: FileSearch,
      status: plannerStatus(phase),
      detail: phase === "planning" ? "Drafting outline…" : undefined,
    },
    {
      name: "Writer",
      role: "Writes each section in context",
      icon: PenLine,
      status: writerStatus(phase, completed, total),
      detail:
        phase === "generating"
          ? `${currentTitle ? `Writing: ${currentTitle} · ` : ""}${completed}/${total} sections`
          : undefined,
    },
    {
      name: "Reviewer",
      role: "Scores quality and suggests edits",
      icon: ClipboardCheck,
      status: "idle",
    },
    {
      name: "Validator",
      role: "Checks structure and consistency",
      icon: ShieldCheck,
      status: "idle",
    },
    {
      name: "Researcher",
      role: "Collects references and sources",
      icon: Search,
      status: "idle",
    },
  ];

  return (
    <div className="p-2">
      {active && (
        <div className="mb-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium">Document progress</span>
            <span className="tabular-nums text-muted-foreground">
              {completed}/{total}
            </span>
          </div>
          <Progress value={total > 0 ? (completed / total) * 100 : 5} className="h-1.5" />
        </div>
      )}

      <div className="space-y-1">
        {agents.map((agent) => {
          const style = STATUS_STYLE[agent.status];
          return (
            <div
              key={agent.name}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors",
                agent.status === "running" && "border-primary/20 bg-primary/[0.04]",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                  agent.status === "running"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/40 text-muted-foreground",
                )}
              >
                <agent.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] font-medium">
                  {agent.name}
                  {style.spin ? (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  ) : agent.status === "completed" ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : null}
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {agent.detail ?? agent.role}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                {style.label}
              </span>
            </div>
          );
        })}
      </div>

      {failed > 0 && (
        <p className="mx-3 mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
          {failed} section{failed === 1 ? "" : "s"} failed — resume from the composer to retry.
        </p>
      )}
    </div>
  );
}
