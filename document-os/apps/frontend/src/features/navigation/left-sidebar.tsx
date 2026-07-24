import { LayoutDashboard, LayoutTemplate, PanelLeftClose, Search } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@documentos/utils";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUiStore } from "@/lib/ui-store";
import { ProjectsNav, RecentNav } from "./project-nav";
import { useCurrentWorkspace } from "./use-current-workspace";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/templates", label: "Templates", icon: LayoutTemplate, end: false },
];

export function LeftSidebar({ onCollapse }: { onCollapse?: () => void }) {
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const { workspace, data: workspaces, isLoading, isError, refetch } = useCurrentWorkspace();

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-gradient-to-b from-slate-50/90 via-indigo-50/30 to-white/90 dark:from-zinc-950/90 dark:via-indigo-950/20 dark:to-zinc-950/90 border-r border-indigo-200/60 dark:border-indigo-900/50 shadow-xs">
      <div className="flex h-[52px] items-center gap-1 border-b border-indigo-200/50 dark:border-indigo-900/40 bg-white/70 dark:bg-zinc-900/70 px-2 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <WorkspaceSwitcher workspaces={workspaces ?? []} workspace={workspace} />
          )}
        </div>
        {onCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" onClick={onCollapse} aria-label="Collapse sidebar">
                <PanelLeftClose className="h-4 w-4 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Collapse sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="min-w-0 px-2 pb-1 pt-2">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex min-w-0 w-full items-center gap-2 rounded-md border border-border/60 bg-background/50 px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate text-left">Search</span>
          <kbd className="shrink-0 rounded border border-border/60 bg-muted px-1 text-[10px] font-medium text-muted-foreground">
            Ctrl K
          </kbd>
        </button>
      </div>

      <nav className="min-w-0 space-y-0.5 px-2 py-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <ScrollArea className="min-h-0 min-w-0 flex-1 w-full">
        {isError ? (
          <ErrorState
            className="py-8"
            message="Could not load your workspace."
            onRetry={() => void refetch()}
          />
        ) : workspace ? (
          <div className="flex min-h-full flex-col justify-between pb-3">
            <ProjectsNav workspaceId={workspace.id} />
            <div className="mt-auto pt-2 border-t border-border/40">
              <RecentNav workspaceId={workspace.id} />
            </div>
          </div>
        ) : (
          !isLoading && (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Create a workspace to get started.
            </p>
          )
        )}
      </ScrollArea>

      <div className="border-t border-border/60 p-2">
        <UserMenu />
      </div>
    </div>
  );
}
