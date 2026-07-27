import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorStore, type InspectorTab } from "@/features/editor/editor-store";

// Placeholder workspace ID — in production, resolve from active workspace
const PLACEHOLDER_WS = "__workspace__";
import { OutlineTab } from "./outline-tab";
import { PromptsTab } from "./prompts-tab";
import { ReviewTab } from "./review-tab";
import { KnowledgeGraphPanel } from "@/features/knowledge-graph/knowledge-graph-panel";
import { HealthScorePanel } from "@/features/knowledge-graph/health-score-panel";
import { BrainPanel } from "@/features/knowledge-graph/brain-panel";
import { DecisionLogPanel } from "@/features/knowledge-graph/decision-log-panel";
import { MemoryBrowserPanel } from "@/features/knowledge-graph/memory-browser-panel";

/** Right-hand inspector shown on /doc/* routes. */
export function Inspector({ documentId }: { documentId: string }) {
  const tab = useEditorStore((s) => s.inspectorTab);
  const setTab = useEditorStore((s) => s.setInspectorTab);

  const tabs: { value: InspectorTab; label: string; panel: React.ReactNode }[] = [
    { value: "outline", label: "Outline", panel: <OutlineTab documentId={documentId} /> },
    { value: "prompts", label: "Prompts", panel: <PromptsTab documentId={documentId} /> },
    { value: "review", label: "Review", panel: <ReviewTab documentId={documentId} /> },
    { value: "knowledge", label: "Graph", panel: <KnowledgeGraphPanel /> },
    { value: "health", label: "Health", panel: <HealthScorePanel workspaceId={PLACEHOLDER_WS} /> },
    { value: "brain", label: "Brain", panel: <BrainPanel /> },
    { value: "decisions", label: "Decisions", panel: <DecisionLogPanel /> },
    { value: "memory", label: "Memory", panel: <MemoryBrowserPanel /> },
  ];

  return (
    <div className="flex h-full flex-col bg-card/40">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as InspectorTab)}
        className="flex h-full flex-col"
      >
        <div className="flex h-[52px] items-center border-b border-border/60 bg-background/80 px-2 backdrop-blur-sm overflow-x-auto">
          <TabsList className="flex h-8 w-full gap-0.5">
            {tabs.slice(0, 4).map(t => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs px-2">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="flex h-[36px] items-center border-b border-border/60 bg-background/50 px-2 overflow-x-auto">
          <TabsList className="flex h-6 w-full gap-0.5">
            {tabs.slice(4).map(t => (
              <TabsTrigger key={t.value} value={t.value} className="text-[10px] px-2 py-0.5 h-5">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {tabs.map(t => (
            <TabsContent key={t.value} value={t.value} className="m-0 h-full">
              {t.panel}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
