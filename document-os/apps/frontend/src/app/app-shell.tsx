import { PanelLeftOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  "w-px bg-border transition-colors data-[resize-handle-state=drag]:bg-primary/60 hover:bg-primary/40 hidden md:block";

/**
 * Three-column workspace: sidebar | canvas | inspector (inspector only on /doc/*).
 * Mobile responsive: Automatically uses slide-over overlay drawers on small screens (< 768px).
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

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setLeftCollapsed(true);
        setRightCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setLeftCollapsed, setRightCollapsed]);

  // Store is the source of truth for collapse; refs execute the panel motion.
  useEffect(() => {
    const panel = leftRef.current;
    if (!panel || isMobile) return;
    if (leftCollapsed && !panel.isCollapsed()) panel.collapse();
    if (!leftCollapsed && panel.isCollapsed()) panel.resize(leftSize);
  }, [leftCollapsed, isMobile, leftSize]);

  useEffect(() => {
    const panel = rightRef.current;
    if (!panel || isMobile) return;
    if (rightCollapsed && !panel.isCollapsed()) panel.collapse();
    if (!rightCollapsed && panel.isCollapsed()) panel.resize(rightSize);
  }, [rightCollapsed, documentId, isMobile, rightSize]);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="h-screen w-full overflow-hidden bg-background text-[14px]">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Desktop Left Panel */}
          <Panel
            ref={leftRef}
            order={1}
            collapsible
            collapsedSize={0}
            minSize={16}
            maxSize={32}
            defaultSize={leftCollapsed || isMobile ? 0 : Math.max(leftSize, 18)}
            className="hidden md:block overflow-hidden"
            onCollapse={() => setLeftCollapsed(true)}
            onExpand={() => setLeftCollapsed(false)}
            onResize={(size) => {
              if (size > 0) setLeftSize(Math.round(size * 10) / 10);
            }}
          >
            <LeftSidebar onCollapse={() => setLeftCollapsed(true)} />
          </Panel>

          <PanelResizeHandle className={HANDLE_CLASS} />

          {/* Main Content Area */}
          <Panel order={2} minSize={36}>
            <div className="relative h-full overflow-hidden">
              {leftCollapsed && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Expand sidebar"
                  onClick={() => setLeftCollapsed(false)}
                  className="absolute left-2 top-2 z-20 bg-background/90 backdrop-blur-md shadow-sm border-indigo-200/60 dark:border-indigo-900/60"
                >
                  <PanelLeftOpen className="h-4 w-4 text-primary" />
                </Button>
              )}
              <Outlet />
            </div>
          </Panel>

          {/* Desktop Right Inspector Panel */}
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
                defaultSize={rightCollapsed || isMobile ? 0 : rightSize}
                className="hidden md:block overflow-hidden"
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

        {/* Mobile Slide-Over Left Sidebar Drawer */}
        {isMobile && !leftCollapsed && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
              onClick={() => setLeftCollapsed(true)}
            />
            <div className="relative z-50 w-72 max-w-[85vw] bg-card h-full border-r border-border shadow-2xl">
              <LeftSidebar onCollapse={() => setLeftCollapsed(true)} />
            </div>
          </div>
        )}

        {/* Mobile Slide-Over Right Inspector Drawer */}
        {isMobile && documentId && !rightCollapsed && (
          <div className="fixed inset-0 z-50 flex justify-end md:hidden">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
              onClick={() => setRightCollapsed(true)}
            />
            <div className="relative z-50 w-80 max-w-[88vw] bg-card h-full border-l border-border shadow-2xl flex flex-col">
              <div className="flex items-center justify-between border-b p-2 bg-muted/40">
                <span className="text-xs font-semibold px-2">Document Inspector</span>
                <Button size="icon-sm" variant="ghost" onClick={() => setRightCollapsed(true)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <Inspector documentId={documentId} />
              </div>
            </div>
          </div>
        )}

        <CommandPalette />
      </div>
    </TooltipProvider>
  );
}
