import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon: Icon, title, hint, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-12 text-center ${className ?? ""}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-muted/50">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-1 text-sm font-medium">{title}</p>
      {hint && <p className="max-w-[260px] text-xs text-muted-foreground">{hint}</p>}
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
