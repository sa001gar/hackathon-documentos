import { useEffect } from "react";
import { useUiStore, type Theme } from "@/lib/ui-store";

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const resolvedTheme: "light" | "dark" = theme === "system" ? systemTheme() : theme;

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved = theme === "system" ? systemTheme() : theme;
      root.classList.toggle("dark", resolved === "dark");
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return { theme, setTheme: (t: Theme) => setTheme(t), resolvedTheme };
}
