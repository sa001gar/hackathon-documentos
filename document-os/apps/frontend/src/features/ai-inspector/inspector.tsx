import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorStore, type InspectorTab } from "@/features/editor/editor-store";
import { OutlineTab } from "./outline-tab";
import { PromptsTab } from "./prompts-tab";
import { ReviewTab } from "./review-tab";

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
          <TabsList className="grid h-8 w-full grid-cols-3">
            <TabsTrigger value="outline" className="text-xs">
              Outline
            </TabsTrigger>
            <TabsTrigger value="prompts" className="text-xs">
              Prompts
            </TabsTrigger>
            <TabsTrigger value="review" className="text-xs">
              Review
            </TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="outline" className="m-0">
            <OutlineTab documentId={documentId} />
          </TabsContent>
          <TabsContent value="prompts" className="m-0">
            <PromptsTab documentId={documentId} />
          </TabsContent>
          <TabsContent value="review" className="m-0">
            <ReviewTab documentId={documentId} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
