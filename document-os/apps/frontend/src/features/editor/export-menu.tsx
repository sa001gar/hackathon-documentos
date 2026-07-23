import type { ExportFormat } from "@documentos/shared-types";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiClientError, exportApi } from "@/lib/api-client";

export const EXPORT_FORMATS: { format: ExportFormat; label: string; ext: string }[] = [
  { format: "markdown", label: "Markdown (.md)", ext: "md" },
  { format: "html", label: "HTML (.html)", ext: "html" },
  { format: "pdf", label: "PDF (.pdf)", ext: "pdf" },
  { format: "docx", label: "Word (.docx)", ext: "docx" },
  { format: "json", label: "JSON (.json)", ext: "json" },
];

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "document";
}

/** Shared export flow: create export job, then trigger the file download. */
export function useExportDocument(documentId: string | undefined, title: string) {
  const mutation = useMutation({
    mutationFn: async (format: ExportFormat) => {
      const ext = EXPORT_FORMATS.find((f) => f.format === format)?.ext ?? format;
      const job = await exportApi.create(documentId!, format);
      await exportApi.download(job.id, `${slugify(title)}.${ext}`);
      return format;
    },
    onSuccess: (format) => toast.success(`Exported as ${format.toUpperCase()}`),
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Export failed"),
  });

  return {
    exportDocument: (format: ExportFormat) => {
      if (documentId && !mutation.isPending) mutation.mutate(format);
    },
    exportingFormat: mutation.isPending ? (mutation.variables ?? null) : null,
  };
}

export function ExportMenu({ documentId, title }: { documentId: string; title: string }) {
  const { exportDocument, exportingFormat } = useExportDocument(documentId, title);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4" />
          Export
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {EXPORT_FORMATS.map(({ format, label }) => (
          <DropdownMenuItem key={format} onSelect={() => exportDocument(format)} disabled={!!exportingFormat}>
            {exportingFormat === format ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
