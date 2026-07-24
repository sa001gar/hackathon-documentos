import { motion } from "framer-motion";
import { PencilSparkles } from "@/components/ui/pencil-sparkles";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Canvas placeholder shown while the Planner agent drafts the outline —
 * keeps the UI alive during the one blocking LLM call before sections exist.
 */
export function PlanningState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-6"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <PencilSparkles className="h-4 w-4 animate-pulse" />
        Planning your document outline…
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        The Planner is structuring your document. Sections will appear here in a moment, then the
        Writer starts filling them in live.
      </p>
      <div className="mt-5 space-y-2.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
    </motion.div>
  );
}
