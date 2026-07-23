import type { Template, TemplateSection } from "@documentos/shared-types";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LayoutTemplate } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { templateApi } from "@/lib/api-client";
import { CreateDocumentDialog } from "@/features/dashboard/create-document-dialog";
import { useCurrentWorkspace } from "@/features/navigation/use-current-workspace";

const MAX_PREVIEW_ROWS = 7;

function flattenStructure(sections: TemplateSection[]): { title: string; depth: number }[] {
  const out: { title: string; depth: number }[] = [];
  const walk = (items: TemplateSection[], depth: number) => {
    for (const item of items) {
      out.push({ title: item.title, depth });
      if (item.children?.length) walk(item.children, depth + 1);
    }
  };
  walk(sections, 0);
  return out;
}

function StructurePreview({ structure }: { structure: TemplateSection[] }) {
  const flat = useMemo(() => flattenStructure(structure), [structure]);
  const shown = flat.slice(0, MAX_PREVIEW_ROWS);
  const remaining = flat.length - shown.length;
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <div className="space-y-1">
        {shown.map((row, i) => (
          <div key={i} className="flex items-center gap-2" style={{ paddingLeft: row.depth * 14 }}>
            <span
              className={
                row.depth === 0
                  ? "h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
                  : "h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
              }
            />
            <span
              className={
                row.depth === 0
                  ? "truncate text-xs font-medium text-foreground"
                  : "truncate text-xs text-muted-foreground"
              }
            >
              {row.title}
            </span>
          </div>
        ))}
        {remaining > 0 && (
          <p className="pl-4 text-[10px] text-muted-foreground/70">+{remaining} more sections</p>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template, onUse }: { template: Template; onUse: (t: Template) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm">{template.name}</CardTitle>
            {template.is_builtin && <Badge variant="secondary">Built-in</Badge>}
          </div>
          {template.description && (
            <CardDescription className="line-clamp-2 text-xs">{template.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <div className="flex-1">
            <StructurePreview structure={template.structure} />
          </div>
          <Button size="sm" variant="outline" className="w-full" onClick={() => onUse(template)}>
            Use template
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function TemplatesPage() {
  const { workspace } = useCurrentWorkspace();
  const { data: templates, isLoading, isError, refetch } = useQuery({
    queryKey: ["templates"],
    queryFn: () => templateApi.list(),
  });
  const [using, setUsing] = useState<Template | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Template[]>();
    for (const t of templates ?? []) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [templates]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <h1 className="text-xl font-semibold tracking-tight">Templates</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Structured starting points — materialize one into a project, then let the AI fill it in.
          </p>
        </motion.div>

        {isLoading && (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        )}

        {isError && (
          <ErrorState
            className="py-16"
            message="Could not load templates."
            onRetry={() => void refetch()}
          />
        )}

        {!isLoading && !isError && grouped.length === 0 && (
          <div className="mt-8 rounded-lg border border-dashed border-border">
            <EmptyState
              icon={LayoutTemplate}
              title="No templates available"
              hint="Templates are seeded by the backend. Check that the server is running."
            />
          </div>
        )}

        {grouped.map(([category, items]) => (
          <section key={category} className="mt-8">
            <h2 className="mb-3 text-sm font-medium capitalize">{category}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <TemplateCard key={t.id} template={t} onUse={setUsing} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <CreateDocumentDialog
        open={!!using}
        onOpenChange={(open) => {
          if (!open) setUsing(null);
        }}
        workspaceId={workspace?.id}
        defaultTitle={using?.name ?? ""}
        templateId={using?.id}
        templateName={using?.name}
      />
    </div>
  );
}
