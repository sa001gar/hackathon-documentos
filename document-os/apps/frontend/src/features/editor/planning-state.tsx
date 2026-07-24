import { motion } from "framer-motion";
import { ListTree, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenerationStore } from "./generation-store";

/** Extract section titles discovered so far in the streamed planner JSON. */
function extractTitles(planJson: string): string[] {
  const titles: string[] = [];
  const re = /"title":\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(planJson)) !== null) {
    try {
      const t = JSON.parse(`"${m[1]}"`) as string;
      if (t.trim() && !titles.includes(t)) titles.push(t);
    } catch {
      /* partial escape — wait for more tokens */
    }
  }
  return titles;
}

/**
 * Canvas placeholder shown while the Planner agent drafts the outline.
 * The planner streams its output token-by-token; we surface discovered
 * section titles live so the user watches the outline form in real time.
 */
export function PlanningState() {
  const planTokens = useGenerationStore((s) => s.planTokens);
  const titles = useMemo(() => extractTitles(planTokens), [planTokens]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-6"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4 animate-pulse" />
        Planning your document outline…
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        The Planner is structuring your document. Sections appear below as they're discovered,
        then the Writer starts filling them in live.
      </p>

      {titles.length > 0 ? (
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <ListTree className="h-3 w-3" />
            Discovered sections
          </div>
          {titles.map((title, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 text-[13px]"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                {i + 1}
              </span>
              <span className="truncate">{title}</span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3.5 w-3/5" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      )}
    </motion.div>
  );
}
