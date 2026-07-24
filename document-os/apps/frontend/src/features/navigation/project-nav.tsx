import type { DocumentSummary, Project } from "@documentos/shared-types";
import { cn, formatRelativeTime } from "@documentos/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileText, FolderPlus, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { StatusDot, DOCUMENT_DOT_COLORS } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError, documentApi, projectApi } from "@/lib/api-client";
import { useProjectDocuments, useProjects, useWorkspaceDocuments } from "./use-current-workspace";

function ProjectItem({ project }: { project: Project }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const { data: documents, isLoading } = useProjectDocuments(project.id, open);

  const createDoc = useMutation({
    mutationFn: (title: string) => documentApi.create(project.id, { title }),
    onSuccess: (doc) => {
      void queryClient.invalidateQueries({ queryKey: ["documents", project.id] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-documents"] });
      setDocTitle("");
      setCreatingDoc(false);
      navigate(`/doc/${doc.id}`);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create document"),
  });

  const deleteProject = useMutation({
    mutationFn: () => projectApi.remove(project.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["projects", project.workspace_id] });

      const previousProjects = queryClient.getQueryData<Project[]>(["projects", project.workspace_id]);

      if (previousProjects) {
        queryClient.setQueryData<Project[]>(
          ["projects", project.workspace_id],
          previousProjects.filter((p) => p.id !== project.id),
        );
      }

      toast.success(`Project "${project.name}" deleted`);
      return { previousProjects };
    },
    onError: (err, _vars, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(["projects", project.workspace_id], context.previousProjects);
      }
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete project");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects", project.workspace_id] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-documents"] });
    },
  });

  const submitDoc = () => {
    const title = docTitle.trim();
    if (title) createDoc.mutate(title);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group flex min-w-0 w-full items-center gap-1 rounded-md pr-1 hover:bg-accent">
        <CollapsibleTrigger asChild>
          <button className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-[13px] focus-visible:outline-none">
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-90",
              )}
            />
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: project.color || "#6366f1" }}
            />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground/90">{project.name}</span>
          </button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-5 w-5 shrink-0"
            aria-label={`New document in ${project.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              setCreatingDoc(true);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-5 w-5 shrink-0"
                aria-label={`Options for ${project.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 text-xs">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  deleteProject.mutate();
                }}
                className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CollapsibleContent className="min-w-0 w-full">
        <div className="ml-[18px] min-w-0 border-l border-border/60 pl-1.5">
          {creatingDoc && (
            <div className="flex min-w-0 items-center gap-1 py-0.5 pr-1">
              <Input
                autoFocus
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitDoc();
                  if (e.key === "Escape") {
                    setCreatingDoc(false);
                    setDocTitle("");
                  }
                }}
                onBlur={() => {
                  if (!docTitle.trim()) setCreatingDoc(false);
                }}
                placeholder="Document title"
                className="h-6 text-xs"
                disabled={createDoc.isPending}
              />
            </div>
          )}
          {isLoading && (
            <div className="space-y-1.5 py-1.5 pr-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          )}
          {!isLoading && (documents ?? []).length === 0 && !creatingDoc && (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">No documents</p>
          )}
          {(documents ?? []).map((doc) => (
            <DocumentRow key={doc.id} doc={doc} active={location.pathname === `/doc/${doc.id}`} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DocumentRow({ doc, active }: { doc: DocumentSummary; active: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const deleteDoc = useMutation({
    mutationFn: () => documentApi.remove(doc.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["documents", doc.project_id] });

      const previousDocs = queryClient.getQueryData<DocumentSummary[]>(["documents", doc.project_id]);

      if (previousDocs) {
        queryClient.setQueryData<DocumentSummary[]>(
          ["documents", doc.project_id],
          previousDocs.filter((d) => d.id !== doc.id),
        );
      }

      toast.success("Document deleted");
      if (location.pathname === `/doc/${doc.id}`) {
        navigate("/");
      }

      return { previousDocs };
    },
    onError: (err, _vars, context) => {
      if (context?.previousDocs) {
        queryClient.setQueryData(["documents", doc.project_id], context.previousDocs);
      }
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete document");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents", doc.project_id] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-documents"] });
    },
  });

  return (
    <div
      onClick={() => navigate(`/doc/${doc.id}`)}
      className={cn(
        "group/doc flex min-w-0 w-full items-center justify-between gap-1 rounded-md px-2 py-1 text-left text-[13px] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors",
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <StatusDot status={doc.status} map={DOCUMENT_DOT_COLORS} className="h-1.5 w-1.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{doc.title}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/doc:opacity-100 hover:bg-accent-foreground/10 hover:text-foreground"
            aria-label="Document options"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32 text-xs">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              deleteDoc.mutate();
            }}
            className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ProjectsNav({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useProjects(workspaceId);
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const createProject = useMutation({
    mutationFn: (projectName: string) => projectApi.create(workspaceId, { name: projectName }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      setName("");
      setCreating(false);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create project"),
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0 px-2">
      <div className="flex items-center justify-between px-2 pb-1 pt-3">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-none transition-colors">
            <ChevronRight
              className={cn("h-3 w-3 shrink-0 transition-transform duration-150", open && "rotate-90")}
            />
            <span>Projects</span>
          </button>
        </CollapsibleTrigger>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-5 w-5 shrink-0"
          aria-label="New project"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
            setCreating((v) => !v);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <CollapsibleContent className="min-w-0">
        {creating && (
          <div className="flex min-w-0 items-center gap-1.5 px-2 py-1">
            <FolderPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) createProject.mutate(name.trim());
                if (e.key === "Escape") {
                  setCreating(false);
                  setName("");
                }
              }}
              onBlur={() => {
                if (!name.trim()) setCreating(false);
              }}
              placeholder="Project name"
              className="h-6 text-xs"
              disabled={createProject.isPending}
            />
          </div>
        )}
        {isLoading && (
          <div className="space-y-1.5 px-2 py-1">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        )}
        {!isLoading && (projects ?? []).length === 0 && !creating && (
          <p className="px-2 py-1 text-[11px] text-muted-foreground">
            No projects yet — create one to start.
          </p>
        )}
        <div className="min-w-0 space-y-0.5">
          {(projects ?? []).map((project) => (
            <ProjectItem key={project.id} project={project} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RecentNav({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { documents, isLoading } = useWorkspaceDocuments(workspaceId);
  const [open, setOpen] = useState(false);
  const recent = documents.slice(0, 5);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0 px-2">
      <div className="px-2 pb-1 pt-3">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-none transition-colors">
            <ChevronRight
              className={cn("h-3 w-3 shrink-0 transition-transform duration-150", open && "rotate-90")}
            />
            <span>Recent</span>
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="min-w-0">
        {isLoading && (
          <div className="space-y-1.5 px-2 py-1">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        )}
        {!isLoading && recent.length === 0 && (
          <p className="px-2 py-1 text-[11px] text-muted-foreground">Nothing opened yet.</p>
        )}
        <div className="min-w-0 space-y-0.5">
          {recent.map((doc) => (
            <button
              key={doc.id}
              onClick={() => navigate(`/doc/${doc.id}`)}
              className={cn(
                "flex min-w-0 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                location.pathname === `/doc/${doc.id}`
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{doc.title}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground/70">
                {formatRelativeTime(doc.updated_at)}
              </span>
            </button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
