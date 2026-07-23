import { PanelLeftOpen } from "lucide-react";
import { useEffect, useRef } from "react";
import { Outlet, useMatch } from "react-router-dom";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUiStore } from "@/lib/ui-store";
import { Inspector } from "@/features/ai-inspector/inspector";
import { LeftSidebar } from "@/features/navigation/left-sidebar";
import { CommandPalette } from "@/features/search/command-palette";

const HANDLE_CLASS =
  "w-px bg-border transition-colors data-[resize-handle-state=drag]:bg-primary/60 hover:bg-primary/40";

/**
 * Three-column workspace: sidebar | canvas | inspector (inspector only on /doc/*).
 * Panel sizes + collapse state persist in the ui store.
 */
export function AppShell() {
  const docMatch = useMatch("/doc/:documentId");
  const documentId = docMatch?.params.documentId ?? null;

  const leftSize = useUiStore((s) => s.leftSize);
  const rightSize = useUiStore((s) => s.rightSize);
  const setLeftSize = useUiStore((s) => s.setLeftSize);
  const setRightSize = useUiStore((s) => s.setRightSize);
  const leftCollapsed = useUiStore((s) => s.leftCollapsed);
  const rightCollapsed = useUiStore((s) => s.rightCollapsed);
  const setLeftCollapsed = useUiStore((s) => s.setLeftCollapsed);
  const setRightCollapsed = useUiStore((s) => s.setRightCollapsed);

  const leftRef = useRef<ImperativePanelHandle>(null);
  const rightRef = useRef<ImperativePanelHandle>(null);

  // Store is the source of truth for collapse; refs execute the panel motion.
  useEffect(() => {
    const panel = leftRef.current;
    if (!panel) return;
    if (leftCollapsed && !panel.isCollapsed()) panel.collapse();
    if (!leftCollapsed && panel.isCollapsed()) panel.resize(leftSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftCollapsed]);

  useEffect(() => {
    const panel = rightRef.current;
    if (!panel) return;
    if (rightCollapsed && !panel.isCollapsed()) panel.collapse();
    if (!rightCollapsed && panel.isCollapsed()) panel.resize(rightSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightCollapsed, documentId]);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="h-screen w-full overflow-hidden bg-background text-[14px]">
        <PanelGroup direction="horizontal" className="h-full">
          <Panel
            ref={leftRef}
            order={1}
            collapsible
            collapsedSize={0}
            minSize={14}
            maxSize={28}
            defaultSize={leftCollapsed ? 0 : leftSize}
            onCollapse={() => setLeftCollapsed(true)}
            onExpand={() => setLeftCollapsed(false)}
            onResize={(size) => {
              if (size > 0) setLeftSize(Math.round(size * 10) / 10);
            }}
          >
            <LeftSidebar onCollapse={() => setLeftCollapsed(true)} />
          </Panel>
          <PanelResizeHandle className={HANDLE_CLASS} />
          <Panel order={2} minSize={36}>
            <div className="relative h-full overflow-hidden">
              {leftCollapsed && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Expand sidebar"
                  onClick={() => setLeftCollapsed(false)}
                  className="absolute left-2 top-2 z-20 bg-background/80 backdrop-blur-sm"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )}
              <Outlet />
            </div>
          </Panel>
          {documentId && (
            <>
              <PanelResizeHandle className={HANDLE_CLASS} />
              <Panel
                ref={rightRef}
                order={3}
                collapsible
                collapsedSize={0}
                minSize={16}
                maxSize={36}
                defaultSize={rightCollapsed ? 0 : rightSize}
                onCollapse={() => setRightCollapsed(true)}
                onExpand={() => setRightCollapsed(false)}
                onResize={(size) => {
                  if (size > 0) setRightSize(Math.round(size * 10) / 10);
                }}
              >
                <Inspector documentId={documentId} />
              </Panel>
            </>
          )}
        </PanelGroup>
        <CommandPalette />
      </div>
    </TooltipProvider>
  );
}
