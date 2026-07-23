import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiClientError, documentApi } from "@/lib/api-client";
import { useProjects } from "@/features/navigation/use-current-workspace";

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  /** Preselected project (optional). */
  projectId?: string;
  defaultTitle?: string;
  templateId?: string;
  templateName?: string;
}

export function CreateDocumentDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  defaultTitle = "",
  templateId,
  templateName,
}: CreateDocumentDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useProjects(workspaceId);
  const [selectedProject, setSelectedProject] = useState<string>(projectId ?? "");
  const [title, setTitle] = useState(defaultTitle);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setSelectedProject(projectId ?? projects?.[0]?.id ?? "");
    }
  }, [open, defaultTitle, projectId, projects]);

  const createMutation = useMutation({
    mutationFn: () =>
      documentApi.create(selectedProject, {
        title: title.trim(),
        ...(templateId ? { template_id: templateId } : {}),
      }),
    onSuccess: (doc) => {
      void queryClient.invalidateQueries({ queryKey: ["documents", doc.project_id] });
      onOpenChange(false);
      navigate(`/doc/${doc.id}`);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create document"),
  });

  const canSubmit = !!selectedProject && title.trim().length > 0 && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{templateName ? `Use "${templateName}"` : "New document"}</DialogTitle>
          <DialogDescription>
            {templateName
              ? "Pick a project — the template structure is materialized as sections."
              : "Create a blank document in one of your projects."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-project">Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject} disabled={isLoading}>
              <SelectTrigger id="doc-project">
                <SelectValue placeholder={isLoading ? "Loading projects…" : "Select a project"} />
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.color || "#6366f1" }}
                      />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) createMutation.mutate();
              }}
              placeholder="e.g. Q3 Product Spec"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
