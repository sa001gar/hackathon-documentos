import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorStore, type InspectorTab } from "@/features/editor/editor-store";
import { ActivityTab } from "./activity-tab";
import { AiAgentsTab } from "./ai-agents-tab";
import { OutlineTab } from "./outline-tab";
import { ReviewTab } from "./review-tab";
import { ValidateTab } from "./validate-tab";

/** Right-hand inspector shown on /doc/* routes. */
export function Inspector({ documentId }: { documentId: string }) {
  const tab = useEditorStore((s) => s.inspectorTab);
  const setTab = useEditorStore((s) => s.setInspectorTab);

  return (
    <div className="flex h-full flex-col bg-card/40">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as InspectorTab)}
        className="flex h-full flex-col"
      >
        <div className="flex h-[52px] items-center border-b border-border/60 bg-background/80 px-2 backdrop-blur-sm">
          <TabsList className="grid h-8 w-full grid-cols-5">
            <TabsTrigger value="outline" className="text-xs">
              Outline
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-xs">
              Agents
            </TabsTrigger>
            <TabsTrigger value="validate" className="text-xs">
              Validate
            </TabsTrigger>
            <TabsTrigger value="review" className="text-xs">
              Review
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">
              Activity
            </TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="outline" className="m-0">
            <OutlineTab documentId={documentId} />
          </TabsContent>
          <TabsContent value="agents" className="m-0">
            <AiAgentsTab documentId={documentId} />
          </TabsContent>
          <TabsContent value="validate" className="m-0">
            <ValidateTab documentId={documentId} />
          </TabsContent>
          <TabsContent value="review" className="m-0">
            <ReviewTab documentId={documentId} />
          </TabsContent>
          <TabsContent value="activity" className="m-0">
            <ActivityTab documentId={documentId} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
