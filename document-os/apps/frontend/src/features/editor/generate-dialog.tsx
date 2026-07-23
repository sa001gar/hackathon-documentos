import type { DocumentDetail } from "@documentos/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useGenerationJob } from "@/hooks/use-generation-job";
import { ApiClientError, aiApi } from "@/lib/api-client";
import { useEditorStore } from "./editor-store";

interface GenerateDialogProps {
  document: DocumentDetail;
}

/** Full-document AI generation: prompt → job → live progress → done. */
export function GenerateDialog({ document: doc }: GenerateDialogProps) {
  const queryClient = useQueryClient();
  const open = useEditorStore((s) => s.generateOpen);
  const setOpen = useEditorStore((s) => s.setGenerateOpen);
  const jobId = useEditorStore((s) => s.jobId);
  const setJobId = useEditorStore((s) => s.setJobId);
  const [prompt, setPrompt] = useState("");
  const [useExisting, setUseExisting] = useState(doc.section_count > 0);
  const { job, active } = useGenerationJob(jobId, doc.id);

  useEffect(() => {
    if (open) {
      setPrompt("");
      setUseExisting(doc.section_count > 0);
    }
  }, [open, doc.section_count]);

  // Close + toast when a job finishes while the dialog is open.
  useEffect(() => {
    if (!open || !job) return;
    if (job.status === "completed") {
      toast.success("Document generated");
      setOpen(false);
      setJobId(null);
    } else if (job.status === "failed") {
      toast.error(job.error ?? "Generation failed");
    }
  }, [job?.status, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useMutation({
    mutationFn: () =>
      aiApi.generateDocument(doc.id, {
        prompt: prompt.trim(),
        use_existing_structure: useExisting,
      }),
    onSuccess: (newJob) => setJobId(newJob.id),
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to start generation"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => aiApi.cancelJob(id),
    onSuccess: (cancelled) => {
      queryClient.setQueryData(["job", cancelled.id], cancelled);
      void queryClient.invalidateQueries({ queryKey: ["document", doc.id] });
      toast.info("Generation cancelled");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to cancel job"),
  });

  const showProgress = !!job && (active || job.status === "failed" || job.status === "cancelled");
  const pct = job && job.total_sections > 0 ? (job.completed_sections / job.total_sections) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate with AI
          </DialogTitle>
          <DialogDescription>
            The Planner drafts an outline, then the Writer fills each section sequentially.
          </DialogDescription>
        </DialogHeader>

        {!showProgress ? (
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
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium capitalize">{job.status}</span>
              <span className="text-muted-foreground">
                {job.completed_sections} / {job.total_sections} sections
              </span>
            </div>
            <Progress value={pct} />
            {job.status === "failed" && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {job.error ?? "Generation failed"}
              </p>
            )}
            {active && (
              <p className="text-xs text-muted-foreground">
                Sections appear in the editor as the Writer completes them. You can close this
                dialog — progress continues in the outline.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {!showProgress ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => start.mutate()} disabled={!prompt.trim() || start.isPending}>
                {start.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            </>
          ) : active ? (
            <Button
              variant="outline"
              onClick={() => jobId && cancel.mutate(jobId)}
              disabled={cancel.isPending}
            >
              <XCircle className="h-4 w-4" />
              Cancel generation
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
