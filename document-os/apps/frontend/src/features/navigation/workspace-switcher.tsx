import type { Workspace } from "@documentos/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ApiClientError, workspaceApi } from "@/lib/api-client";
import { useUiStore } from "@/lib/ui-store";

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  workspace: Workspace | undefined;
}

export function WorkspaceSwitcher({ workspaces, workspace }: WorkspaceSwitcherProps) {
  const queryClient = useQueryClient();
  const setLastWorkspaceId = useUiStore((s) => s.setLastWorkspaceId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const createMutation = useMutation({
    mutationFn: (name: string) => workspaceApi.create({ name }),
    onSuccess: (ws) => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setLastWorkspaceId(ws.id);
      setName("");
      setOpen(false);
      toast.success(`Workspace "${ws.name}" created`);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create workspace"),
  });

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) createMutation.mutate(trimmed);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/15 text-[10px] font-semibold text-primary">
            {workspace ? workspace.name.slice(0, 2).toUpperCase() : "—"}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {workspace ? workspace.name : "No workspace"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onSelect={() => {
              setLastWorkspaceId(ws.id);
              setOpen(false);
            }}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/15 text-[9px] font-semibold text-primary">
              {ws.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">{ws.name}</span>
            {ws.id === workspace?.id && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="New workspace name"
            className="h-7 text-xs"
            disabled={createMutation.isPending}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={submit}
            disabled={!name.trim() || createMutation.isPending}
            aria-label="Create workspace"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
