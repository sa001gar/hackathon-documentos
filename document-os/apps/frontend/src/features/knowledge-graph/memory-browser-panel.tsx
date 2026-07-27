import { Database, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memoryApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MemoryItem } from "@documentos/shared-types";

export function MemoryBrowserPanel({}: { projectId?: string; userId?: string } = {}) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const scope = "user" as const;
  const scopeId = "__demo__";

  const { data: memories, isLoading } = useQuery({
    queryKey: ["memory", scope, scopeId],
    queryFn: () => memoryApi.getByScope(scope, scopeId),
    enabled: !!scopeId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => memoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory", scope, scopeId] });
    },
  });

  const filtered = memories?.filter(m =>
    !search || m.key.toLowerCase().includes(search.toLowerCase()) || m.content.toLowerCase().includes(search.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b">
        <Database className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Memory</span>
        <Badge variant="outline" className="ml-auto text-[10px]">{memories?.length || 0}</Badge>
      </div>

      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search memory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-1.5">
          {filtered.map(m => (
            <div key={m.id} className="p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-medium truncate">{m.key}</span>
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0">{m.category}</Badge>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 h-5 w-5"
                  onClick={() => deleteMutation.mutate(m.id)}
                >
                  <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
              {m.content && (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{m.content}</p>
              )}
              <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                <span>confidence: {Math.round(m.confidence * 100)}%</span>
                <span>•</span>
                <span>source: {m.source}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-8">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No memory items found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
