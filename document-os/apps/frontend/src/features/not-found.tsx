import { FileQuestion } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/50">
        <FileQuestion className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-3xl font-semibold tracking-tight">404</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        The page you're looking for doesn't exist or was moved.
      </p>
      <Button size="sm" className="mt-2" onClick={() => navigate("/")}>
        Back to dashboard
      </Button>
    </div>
  );
}
