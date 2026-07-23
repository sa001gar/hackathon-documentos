import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppRoutes } from "@/app/router";
import { useTheme } from "@/hooks/use-theme";
import { usersApi } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

/** Applies the theme class to <html> via the use-theme hook. */
function ThemeProvider({ children }: { children: React.ReactNode }) {
  useTheme();
  return <>{children}</>;
}

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [bootstrapping, setBootstrapping] = useState(() => !!accessToken && !user);

  // Bootstrap the current user into the auth store when a token already exists
  // (page reload). On failure the API client clears the session itself.
  useEffect(() => {
    let cancelled = false;
    if (accessToken && !user) {
      usersApi
        .me()
        .then((me) => {
          if (!cancelled) setUser(me);
        })
        .catch(() => {
          /* 401 handling lives in the API client */
        })
        .finally(() => {
          if (!cancelled) setBootstrapping(false);
        });
    } else {
      setBootstrapping(false);
    }
    return () => {
      cancelled = true;
    };
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bootstrapping) {
    return (
      <ThemeProvider>
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  );
}
