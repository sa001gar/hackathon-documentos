import type { DocumentDetail, Version } from "@documentos/shared-types";
import { cn, formatRelativeTime } from "@documentos/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { History, Loader2, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useMatch } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError, versionApi } from "@/lib/api-client";
import { useEditorStore } from "@/features/editor/editor-store";
import { DiffView } from "./diff-view";

const SOURCE_VARIANT: Record<Version["source"], "secondary" | "default" | "warning"> = {
  manual: "secondary",
  ai: "default",
  restore: "warning",
};

function VersionRow({
  version,
  selected,
  onToggle,
  onRestore,
  restoring,
}: {
  version: Version;
  selected: boolean;
  onToggle: () => void;
  onRestore: () => void;
  restoring: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 transition-colors",
        selected ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-accent/50",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
          aria-label={`Select version ${version.version} for diff`}
        >
          <span
            className={cn(
              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
              selected ? "border-primary bg-primary" : "border-muted-foreground/40",
            )}
          >
            {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
          </span>
          <span className="shrink-0 text-xs font-medium">v{version.version}</span>
          <Badge variant={SOURCE_VARIANT[version.source]} className="text-[10px]">
            {version.source}
          </Badge>
          {version.agent && (
            <span className="truncate text-[10px] capitalize text-muted-foreground">{version.agent}</span>
          )}
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">
            {formatRelativeTime(version.created_at)}
          </span>
        </button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Restore version ${version.version}`}
          disabled={restoring}
          onClick={onRestore}
        >
          {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {version.change_summary && (
        <p className="mt-1 truncate pl-6 text-[11px] text-muted-foreground">{version.change_summary}</p>
      )}
    </div>
  );
}

/** Slide-over version history for one section (diff two, restore any). */
export function VersionsPanel() {
  const queryClient = useQueryClient();
  const sectionId = useEditorStore((s) => s.versionsSectionId);
  const setVersionsSectionId = useEditorStore((s) => s.setVersionsSectionId);
  const docMatch = useMatch("/doc/:documentId");
  const documentId = docMatch?.params.documentId;
  const [selected, setSelected] = useState<string[]>([]);

  const { data: versions, isLoading } = useQuery({
    queryKey: ["versions", sectionId],
    queryFn: () => versionApi.list(sectionId!),
    enabled: !!sectionId,
  });

  const sectionTitle = useMemo(() => {
    const doc = queryClient.getQueryData<DocumentDetail>(["document", documentId]);
    return doc?.sections.find((s) => s.id === sectionId)?.title ?? "Section";
  }, [queryClient, documentId, sectionId]);

  const restore = useMutation({
    mutationFn: (versionId: string) => versionApi.restore(versionId),
    onSuccess: (section) => {
      // Push the restored content into the cached document — the editor's
      // external-content sync picks it up without clobbering other sections.
      queryClient.setQueryData<DocumentDetail>(["document", documentId], (old) =>
        old
          ? {
              ...old,
              sections: old.sections.map((s) =>
                s.id === section.id
                  ? { ...s, content: section.content, word_count: section.word_count, status: section.status }
                  : s,
              ),
            }
          : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["versions", sectionId] });
      toast.success("Version restored");
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Restore failed"),
  });

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-1), id],
    );

  const diffPair = useMemo(() => {
    if (selected.length !== 2 || !versions) return null;
    const [a, b] = selected.map((id) => versions.find((v) => v.id === id)).filter(Boolean) as Version[];
    if (a.version === b.version) return null;
    const [older, newer] = a.version < b.version ? [a, b] : [b, a];
    return { older, newer };
  }, [selected, versions]);

  const close = () => {
    setVersionsSectionId(null);
    setSelected([]);
  };

  return (
    <AnimatePresence>
      {sectionId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={close}
          />
          <motion.aside
            initial={{ x: 440 }}
            animate={{ x: 0 }}
            exit={{ x: 440 }}
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-border bg-popover shadow-2xl"
            role="dialog"
            aria-label="Version history"
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
          >
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <History className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Version history</p>
                <p className="truncate text-xs text-muted-foreground">{sectionTitle}</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={close}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-1.5 p-3">
                <p className="px-1 text-[11px] text-muted-foreground">
                  Select two versions to compare.
                </p>
                {isLoading &&
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                {!isLoading && (versions ?? []).length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                    No versions recorded yet — saves and AI runs create them.
                  </p>
                )}
                {(versions ?? []).map((version) => (
                  <VersionRow
                    key={version.id}
                    version={version}
                    selected={selected.includes(version.id)}
                    onToggle={() => toggle(version.id)}
                    onRestore={() => restore.mutate(version.id)}
                    restoring={restore.isPending && restore.variables === version.id}
                  />
                ))}
              </div>
              {diffPair && (
                <div className="border-t border-border/60 p-3">
                  <p className="mb-2 text-xs font-medium">
                    v{diffPair.older.version} → v{diffPair.newer.version}
                  </p>
                  <DiffView oldContent={diffPair.older.content} newContent={diffPair.newer.content} />
                </div>
              )}
            </ScrollArea>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
