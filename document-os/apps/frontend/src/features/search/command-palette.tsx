import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Brain,
  ClipboardCheck,
  Download,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  LayoutTemplate,
  ListTree,
  Loader2,
  Network,
  ShieldCheck,
  SunMoon,
  Route,
  BookOpen,
  Activity,
  Sparkles,
  Search as SearchIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useTheme } from "@/hooks/use-theme";
import { brainApi, healthScoreApi, kgApi, orchestrateApi, searchApi } from "@/lib/api-client";
import { useUiStore } from "@/lib/ui-store";
import { useEditorStore } from "@/features/editor/editor-store";
import { useCurrentWorkspace } from "@/features/navigation/use-current-workspace";

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const navigate = useNavigate();
  const location = useLocation();
  const { workspace } = useCurrentWorkspace();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);

  const searching = debounced.trim().length > 0;
  const { data: results, isFetching } = useQuery({
    queryKey: ["search", debounced, workspace?.id],
    queryFn: () => searchApi.search(debounced.trim(), workspace?.id),
    enabled: open && searching,
    placeholderData: (prev) => prev,
  });

  // Global Ctrl/Cmd+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const docMatch = location.pathname.match(/^\/doc\/[^/]+/);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const goToSection = (documentId: string, sectionId: string) => {
    useEditorStore.getState().setScrollTarget(sectionId);
    navigate(`/doc/${documentId}`);
  };

  const q = query.trim().toLowerCase();
  const actionVisible = (label: string) => !q || label.toLowerCase().includes(q);
  const hasResults =
    !!results &&
    (results.projects.length > 0 || results.documents.length > 0 || results.sections.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-xl sm:max-w-xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search documents, sections, actions…"
          />
          <CommandList>
            {searching && isFetching && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching…
              </div>
            )}

            {searching && !isFetching && !hasResults && (
              <CommandEmpty>No results for "{debounced.trim()}".</CommandEmpty>
            )}

            {results && results.projects.length > 0 && (
              <CommandGroup heading="Projects">
                {results.projects.map((p) => (
                  <CommandItem key={p.id} value={`project-${p.id}`} onSelect={run(() => navigate("/"))}>
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results && results.documents.length > 0 && (
              <CommandGroup heading="Documents">
                {results.documents.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={`document-${d.id}`}
                    onSelect={run(() => navigate(`/doc/${d.id}`))}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate">{d.title}</span>
                      {d.snippet && (
                        <span className="block truncate text-[11px] text-muted-foreground">{d.snippet}</span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results && results.sections.length > 0 && (
              <CommandGroup heading="Sections">
                {results.sections.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={`section-${s.id}`}
                    onSelect={run(() => goToSection(s.document_id, s.id))}
                  >
                    <ListTree className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate">{s.title}</span>
                      {s.snippet && (
                        <span className="block truncate text-[11px] text-muted-foreground">{s.snippet}</span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(hasResults || searching) && <CommandSeparator />}

            <CommandGroup heading="Actions">
              {docMatch && actionVisible("validate document") && (
                <CommandItem
                  value="action-validate"
                  onSelect={run(() => useEditorStore.getState().requestValidate())}
                >
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Validate current document
                </CommandItem>
              )}
              {docMatch && actionVisible("review document") && (
                <CommandItem
                  value="action-review"
                  onSelect={run(() => useEditorStore.getState().requestReview())}
                >
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  Review current document
                </CommandItem>
              )}
              {docMatch && actionVisible("export document") && (
                <CommandItem
                  value="action-export"
                  onSelect={run(() => useEditorStore.getState().requestAction("export"))}
                >
                  <Download className="h-4 w-4 text-muted-foreground" />
                  Export current document
                  <CommandShortcut>Markdown</CommandShortcut>
                </CommandItem>
              )}
              {actionVisible("new document") && (
                <CommandItem
                  value="action-new-document"
                  onSelect={run(() => navigate("/", { state: { openCreate: "document" } }))}
                >
                  <FilePlus2 className="h-4 w-4 text-muted-foreground" />
                  New document
                </CommandItem>
              )}
              {actionVisible("new project") && (
                <CommandItem
                  value="action-new-project"
                  onSelect={run(() => navigate("/", { state: { openCreate: "project" } }))}
                >
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                  New project
                </CommandItem>
              )}
              {actionVisible("browse templates") && (
                <CommandItem value="action-templates" onSelect={run(() => navigate("/templates"))}>
                  <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                  Browse templates
                </CommandItem>
              )}
              {actionVisible("toggle theme") && (
                <CommandItem
                  value="action-theme"
                  onSelect={run(() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark"))}
                >
                  <SunMoon className="h-4 w-4 text-muted-foreground" />
                  Toggle theme
                  <CommandShortcut className="capitalize">{theme}</CommandShortcut>
                </CommandItem>
              )}
            </CommandGroup>

            {actionVisible("ask brain") && (
              <CommandGroup heading="AI Commands">
                <CommandItem
                  value="ai-brain"
                  onSelect={run(() => {
                    navigate("/");
                    setTimeout(() => useUiStore.getState().setPaletteOpen(true), 100);
                  })}
                >
                  <Brain className="h-4 w-4 text-purple-500" />
                  Ask organization brain
                </CommandItem>
                <CommandItem
                  value="ai-knowledge-graph"
                  onSelect={run(() => {
                    useEditorStore.getState().setInspectorTab("knowledge");
                  })}
                >
                  <Network className="h-4 w-4 text-blue-500" />
                  Explore knowledge graph
                </CommandItem>
                <CommandItem
                  value="ai-health"
                  onSelect={run(() => {
                    useEditorStore.getState().setInspectorTab("health");
                  })}
                >
                  <Activity className="h-4 w-4 text-green-500" />
                  View knowledge health score
                </CommandItem>
                <CommandItem
                  value="ai-decisions"
                  onSelect={run(() => {
                    useEditorStore.getState().setInspectorTab("decisions");
                  })}
                >
                  <BookOpen className="h-4 w-4 text-amber-500" />
                  Browse decision log
                </CommandItem>
                <CommandItem
                  value="ai-impact"
                  onSelect={run(() => {
                    useEditorStore.getState().setInspectorTab("knowledge");
                  })}
                >
                  <Route className="h-4 w-4 text-orange-500" />
                  Run impact analysis
                </CommandItem>
                <CommandItem
                  value="ai-orchestrate"
                  onSelect={run(() => {
                    navigate("/");
                  })}
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI orchestration workflow
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
