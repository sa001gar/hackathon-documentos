import { Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Live token preview shown over a section body while SSE generation runs. */
export function StreamOverlay({ tokens, onStop }: { tokens: string; onStop: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-md border border-primary/30 bg-background/95 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
        <span className="flex items-center gap-2 text-xs font-medium text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          AI is writing…
        </span>
        <Button size="xs" variant="ghost" onClick={onStop}>
          <Square className="h-3 w-3" />
          Stop
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <p className="whitespace-pre-wrap px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
          {tokens || "Waiting for the first tokens…"}
        </p>
      </ScrollArea>
    </div>
  );
}
