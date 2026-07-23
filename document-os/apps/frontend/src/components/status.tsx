import type { DocumentStatus, SectionStatus } from "@documentos/shared-types";
import { cn } from "@documentos/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export const SECTION_DOT_COLORS: Record<SectionStatus, string> = {
  pending: "bg-zinc-400",
  generating: "bg-indigo-400",
  draft: "bg-amber-400",
  reviewed: "bg-sky-400",
  validated: "bg-emerald-400",
  error: "bg-red-400",
};

export const DOCUMENT_DOT_COLORS: Record<DocumentStatus, string> = {
  draft: "bg-zinc-400",
  generating: "bg-indigo-400",
  generated: "bg-sky-400",
  validated: "bg-emerald-400",
  reviewed: "bg-violet-400",
  exported: "bg-amber-400",
};

export function StatusDot({
  status,
  map,
  pulse = false,
  className,
}: {
  status: string;
  map: Record<string, string>;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        map[status] ?? "bg-zinc-400",
        pulse && "animate-pulse",
        className,
      )}
      aria-label={status}
    />
  );
}

const DOCUMENT_BADGE: Record<DocumentStatus, { variant: BadgeProps["variant"]; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  generating: { variant: "default", label: "Generating" },
  generated: { variant: "info", label: "Generated" },
  validated: { variant: "success", label: "Validated" },
  reviewed: { variant: "info", label: "Reviewed" },
  exported: { variant: "warning", label: "Exported" },
};

export function DocumentStatusBadge({ status, className }: { status: DocumentStatus; className?: string }) {
  const cfg = DOCUMENT_BADGE[status] ?? DOCUMENT_BADGE.draft;
  return (
    <Badge variant={cfg.variant} className={className}>
      {cfg.label}
    </Badge>
  );
}

export function SectionStatusChip({ status, className }: { status: SectionStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      <StatusDot status={status} map={SECTION_DOT_COLORS} pulse={status === "generating"} className="h-1.5 w-1.5" />
      {status}
    </span>
  );
}
