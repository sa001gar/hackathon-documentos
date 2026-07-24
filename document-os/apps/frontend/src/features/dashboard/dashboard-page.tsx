import type { DocumentSummary, Project } from "@documentos/shared-types";
import { formatRelativeTime } from "@documentos/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileText, FolderPlus, Layers, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PencilSparkles } from "@/components/ui/pencil-sparkles";
import { DocumentStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError, workspaceApi } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useUiStore } from "@/lib/ui-store";
import { CreateDocumentDialog } from "./create-document-dialog";
import { CreateProjectDialog } from "./create-project-dialog";
import {
  useCurrentWorkspace,
  useWorkspaceDocuments,
} from "@/features/navigation/use-current-workspace";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function CreateWorkspaceCard() {
  const queryClient = useQueryClient();
  const setLastWorkspaceId = useUiStore((s) => s.setLastWorkspaceId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const mutation = useMutation({
    mutationFn: () => workspaceApi.create({ name: name.trim() }),
    onSuccess: (ws) => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setLastWorkspaceId(ws.id);
      setOpen(false);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create workspace"),
  });
  return (
    <div className="flex flex-1 items-center justify-center">
      <EmptyState
        icon={Layers}
        title="Create your first workspace"
        hint="Workspaces contain projects, and projects contain your documents."
        actionLabel="New workspace"
        onAction={() => setOpen(true)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>A workspace is the top-level container for your team.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) mutation.mutate();
            }}
            placeholder="e.g. Acme Corp"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
              Create workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentCard({ doc, project }: { doc: DocumentSummary; project?: Project }) {
  const navigate = useNavigate();
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => navigate(`/doc/${doc.id}`)}
      className="group rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{doc.title}</p>
        <DocumentStatusBadge status={doc.status} />
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{doc.word_count.toLocaleString()} words</span>
        <span aria-hidden>·</span>
        <span>{doc.section_count} sections</span>
        {project && (
          <>
            <span aria-hidden>·</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
              <span className="truncate">{project.name}</span>
            </span>
          </>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground/70">
        Updated {formatRelativeTime(doc.updated_at)}
      </p>
    </motion.button>
  );
}

function ProjectCard({
  project,
  documents,
  onNewDocument,
}: {
  project: Project;
  documents: DocumentSummary[];
  onNewDocument: (projectId: string) => void;
}) {
  const navigate = useNavigate();
  const docs = documents.filter((d) => d.project_id === project.id).slice(0, 3);
  const count = documents.filter((d) => d.project_id === project.id).length;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
          <span className="min-w-0 flex-1 truncate">{project.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {count} {count === 1 ? "doc" : "docs"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {docs.length === 0 && <p className="py-1 text-xs text-muted-foreground">No documents yet.</p>}
        {docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => navigate(`/doc/${doc.id}`)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{doc.title}</span>
            <span className="shrink-0 text-[10px]">{formatRelativeTime(doc.updated_at)}</span>
          </button>
        ))}
        <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-muted-foreground" onClick={() => onNewDocument(project.id)}>
          <Plus className="h-3.5 w-3.5" />
          New document
        </Button>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const { workspace, isLoading: wsLoading, isError, refetch } = useCurrentWorkspace();
  const { documents, isLoading: docsLoading, projects } = useWorkspaceDocuments(workspace?.id);
  const [createDoc, setCreateDoc] = useState<{ open: boolean; projectId?: string }>({ open: false });
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  // Command-palette actions land here via location state.
  useEffect(() => {
    const state = location.state as { openCreate?: string } | null;
    if (state?.openCreate === "document") setCreateDoc({ open: true });
    if (state?.openCreate === "project") setCreateProjectOpen(true);
    if (state?.openCreate) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const firstName = user?.full_name.split(" ")[0] ?? "there";
  const loading = wsLoading || docsLoading;

  if (!wsLoading && !workspace) {
    return (
      <div className="flex h-full flex-col">
        <CreateWorkspaceCard />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {greeting()}, {firstName}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                {workspace ? ` — ${workspace.name}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreateProjectOpen(true)}>
                <FolderPlus className="h-4 w-4" />
                New project
              </Button>
              <Button size="sm" onClick={() => setCreateDoc({ open: true })} disabled={projects.length === 0}>
                <Plus className="h-4 w-4" />
                New document
              </Button>
            </div>
          </div>
        </motion.div>

        {isError && (
          <ErrorState
            className="py-10"
            message="Could not load the dashboard data."
            onRetry={() => void refetch()}
          />
        )}

        {loading && (
          <div className="mt-8 space-y-8">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          </div>
        )}

        {!loading && !isError && (
          <>
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium">Recent documents</h2>
                {documents.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/templates")}>
                    <PencilSparkles className="h-3.5 w-3.5" />
                    Start from a template
                  </Button>
                )}
              </div>
              {documents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border">
                  <EmptyState
                    icon={FileText}
                    title="No documents yet"
                    hint="Create your first document, or let AI draft one from a template."
                    actionLabel="New document"
                    onAction={() => setCreateDoc({ open: true })}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {documents.slice(0, 6).map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} project={projects.find((p) => p.id === doc.project_id)} />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="mb-3 text-sm font-medium">Projects</h2>
              {projects.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border">
                  <EmptyState
                    icon={FolderPlus}
                    title="No projects yet"
                    hint="Projects keep related documents together."
                    actionLabel="New project"
                    onAction={() => setCreateProjectOpen(true)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      documents={documents}
                      onNewDocument={(projectId) => setCreateDoc({ open: true, projectId })}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <CreateDocumentDialog
        open={createDoc.open}
        onOpenChange={(open) => setCreateDoc({ open })}
        workspaceId={workspace?.id}
        projectId={createDoc.projectId}
      />
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        workspaceId={workspace?.id}
      />
    </div>
  );
}
