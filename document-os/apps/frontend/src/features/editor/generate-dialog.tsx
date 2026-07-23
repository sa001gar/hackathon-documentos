import type { DocumentDetail } from "@documentos/shared-types";
import { WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "./editor-store";
import { useGenerationStore } from "./generation-store";

interface GenerateDialogProps {
  document: DocumentDetail;
}

/**
 * Generation launcher. Once started, the dialog closes and the whole pipeline
 * plays out live in the editor canvas, outline, activity feed and progress bar.
 */
export function GenerateDialog({ document: doc }: GenerateDialogProps) {
  const open = useEditorStore((s) => s.generateOpen);
  const setOpen = useEditorStore((s) => s.setGenerateOpen);
  const [prompt, setPrompt] = useState("");
  const [useExisting, setUseExisting] = useState(doc.section_count > 0);

  const start = useGenerationStore((s) => s.start);
  const running = useGenerationStore(
    (s) =>
      s.documentId === doc.id &&
      (s.phase === "connecting" || s.phase === "planning" || s.phase === "generating"),
  );

  useEffect(() => {
    if (open) {
      setPrompt("");
      setUseExisting(doc.section_count > 0);
    }
  }, [open, doc.section_count]);

  const launch = () => {
    setOpen(false);
    void start(doc.id, prompt, useExisting);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-primary" />
            Generate with AI
          </DialogTitle>
          <DialogDescription>
            The Planner drafts an outline, then the Writer fills each section — live, right here in
            the editor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="generate-prompt">What should this document cover?</Label>
            <Textarea
              id="generate-prompt"
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A technical design doc for a realtime collaboration service: goals, architecture, data model, trade-offs, rollout plan."
              className="min-h-[110px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim() && !running) {
                  launch();
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
            <div>
              <p className="text-[13px] font-medium">Use existing structure</p>
              <p className="text-xs text-muted-foreground">
                Keep the current sections and only generate their content.
              </p>
            </div>
            <Switch checked={useExisting} onCheckedChange={setUseExisting} aria-label="Use existing structure" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={launch} disabled={!prompt.trim() || running}>
            <WandSparkles className="h-4 w-4" />
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
