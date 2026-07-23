import { diffLines } from "diff";
import { useMemo } from "react";
import { cn } from "@documentos/utils";

interface DiffViewProps {
  oldContent: string;
  newContent: string;
}

/** Line-based diff of two markdown versions (added = emerald, removed = red). */
export function DiffView({ oldContent, newContent }: DiffViewProps) {
  const parts = useMemo(() => diffLines(oldContent, newContent), [oldContent, newContent]);

  return (
    <div className="overflow-x-auto rounded-md border border-border/60 bg-muted/20 font-mono text-[11px] leading-relaxed">
      {parts.map((part, pi) =>
        part.value
          .replace(/\n$/, "")
          .split("\n")
          .map((line, li) => (
            <div
              key={`${pi}-${li}`}
              className={cn(
                "flex px-2",
                part.added && "bg-emerald-500/15",
                part.removed && "bg-red-500/15",
              )}
            >
              <span
                className={cn(
                  "inline-block w-4 shrink-0 select-none text-right",
                  part.added && "text-emerald-500",
                  part.removed && "text-red-500",
                  !part.added && !part.removed && "text-muted-foreground/40",
                )}
              >
                {part.added ? "+" : part.removed ? "−" : " "}
              </span>
              <span className="whitespace-pre-wrap break-all pl-2">{line || " "}</span>
            </div>
          )),
      )}
    </div>
  );
}
