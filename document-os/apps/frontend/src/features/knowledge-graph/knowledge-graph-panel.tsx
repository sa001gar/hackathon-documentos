import { Network, RotateCw, Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { kgApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KGNode, KGEdge, ImpactAnalysis } from "@documentos/shared-types";

const NODE_COLORS: Record<string, string> = {
  requirement: "bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-950 dark:border-blue-700",
  feature: "bg-green-100 border-green-400 text-green-800 dark:bg-green-950 dark:border-green-700",
  api: "bg-purple-100 border-purple-400 text-purple-800 dark:bg-purple-950 dark:border-purple-700",
  document: "bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-950 dark:border-amber-700",
  decision: "bg-rose-100 border-rose-400 text-rose-800 dark:bg-rose-950 dark:border-rose-700",
  meeting: "bg-cyan-100 border-cyan-400 text-cyan-800 dark:bg-cyan-950 dark:border-cyan-700",
  database: "bg-indigo-100 border-indigo-400 text-indigo-800 dark:bg-indigo-950 dark:border-indigo-700",
  test: "bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700",
};

const EDGE_COLORS: Record<string, string> = {
  implements: "text-green-600",
  depends_on: "text-orange-500",
  affects: "text-red-500",
  relates_to: "text-blue-500",
  documents: "text-slate-500",
  approved_by: "text-purple-500",
};

export function KnowledgeGraphPanel({ workspaceId }: { workspaceId?: string } = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);
  const [graphType, setGraphType] = useState<"workspace" | "search" | "impact">("workspace");

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["kg-search", searchQuery],
    queryFn: () => kgApi.search(searchQuery, workspaceId),
    enabled: searchQuery.length >= 2,
  });

  const { data: workspaceNodes, isLoading: workspaceLoading } = useQuery({
    queryKey: ["kg-workspace", workspaceId],
    queryFn: () => kgApi.getWorkspaceGraph(workspaceId || ""),
    enabled: !!workspaceId && graphType === "workspace",
  });

  const { data: impactData, isLoading: impactLoading } = useQuery({
    queryKey: ["kg-impact", selectedNode?.id],
    queryFn: () => kgApi.getImpact(selectedNode!.id),
    enabled: !!selectedNode && graphType === "impact",
  });

  const handleNodeClick = useCallback((node: KGNode) => {
    setSelectedNode(node);
    setGraphType("impact");
  }, []);

  const displayNodes = useMemo(() => {
    if (graphType === "search") return searchResults || [];
    if (graphType === "impact" && impactData) {
      const nodes = [impactData.node, ...impactData.incoming.map(i => i.source), ...impactData.outgoing.map(o => o.target)];
      return nodes.filter(Boolean) as KGNode[];
    }
    return workspaceNodes || [];
  }, [graphType, searchResults, impactData, workspaceNodes]);

  const displayEdges = useMemo(() => {
    if (graphType === "impact" && impactData) {
      return [
        ...impactData.incoming.map(i => ({ source_id: i.source.id, target_id: i.target.id, relationship: i.relationship, weight: i.weight })),
        ...impactData.outgoing.map(o => ({ source_id: o.source.id, target_id: o.target.id, relationship: o.relationship, weight: o.weight })),
      ];
    }
    return [];
  }, [graphType, impactData]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b">
        <Network className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Knowledge Graph</span>
        <Select value={graphType} onValueChange={(v: "workspace" | "search" | "impact") => { setGraphType(v); setSelectedNode(null); }}>
          <SelectTrigger className="h-7 text-xs w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="workspace">Workspace</SelectItem>
            <SelectItem value="search">Search</SelectItem>
            <SelectItem value="impact">Impact</SelectItem>
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" variant="ghost" onClick={() => setGraphType(graphType)}>
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>

      {graphType === "search" && (
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-3">
        {searchLoading || workspaceLoading || impactLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : displayNodes.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-8">
            <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No nodes found</p>
            <p className="text-xs mt-1">Create documents and decisions to build your knowledge graph</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedNode && impactData && (
              <Card className="p-3 mb-4 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">Impact: {selectedNode.label}</span>
                  <Button size="icon-sm" variant="ghost" onClick={() => { setSelectedNode(null); setGraphType("workspace"); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Incoming: {impactData.incoming.length} relationships</p>
                  <p>Outgoing: {impactData.outgoing.length} relationships</p>
                </div>
              </Card>
            )}

            {displayNodes.map(node => (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all hover:shadow-sm ${
                  NODE_COLORS[node.node_type] || "bg-card border-border"
                } ${selectedNode?.id === node.id ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{node.label}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase">{node.node_type}</Badge>
                </div>
                <div className="text-[10px] opacity-60 mt-0.5">
                  {node.properties?.description ? String(node.properties.description).slice(0, 80) : node.node_type}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
