import { cn } from "@documentos/utils";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Edit3,
  ImageDown,
  Maximize2,
  MousePointerClick,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useTheme } from "@/hooks/use-theme";

let mermaidSeq = 0;

/** Renders a mermaid source string as an SVG diagram with interactive clickable node support. */
export function MermaidDiagram({
  code,
  className,
  onNodeClick,
  onDiagramClick,
}: {
  code: string;
  className?: string;
  onNodeClick?: (nodeText: string) => void;
  onDiagramClick?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const debounced = useDebouncedValue(code, 500);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`docos-mmd-${++mermaidSeq}`);

  useEffect(() => {
    let cancelled = false;
    const source = debounced.trim();
    if (!source) {
      setSvg(null);
      setError(null);
      return;
    }
    const renderId = `${idRef.current}-${Date.now()}`;
    (async () => {
      const mod = await import("mermaid");
      if (cancelled) return;
      const mmd = mod.default;
      mmd.initialize({
        startOnLoad: false,
        theme: resolvedTheme === "dark" ? "dark" : "default",
        securityLevel: "strict",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      });
      try {
        const { svg: rendered } = await mmd.render(renderId, source);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err: unknown) {
        // Mermaid leaves a stray error element in the DOM on parse failures.
        document.getElementById(`d${renderId}`)?.remove();
        document.getElementById(renderId)?.remove();
        if (!cancelled) {
          setSvg(null);
          setError(
            err instanceof Error ? err.message.replace(/\n+/g, " ").slice(0, 200) : "Invalid diagram syntax",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, resolvedTheme]);

  // Attach interactive click handlers to SVG nodes
  useEffect(() => {
    if (!svg || !containerRef.current) return;
    const container = containerRef.current;
    const nodeEls = container.querySelectorAll(".node, g.node, g.cluster, .label");

    const cleanupFns: (() => void)[] = [];

    nodeEls.forEach((nodeEl) => {
      const handler = (e: MouseEvent) => {
        e.stopPropagation();
        const text = nodeEl.textContent?.trim() ?? "";
        if (text && onNodeClick) {
          onNodeClick(text);
        }
      };
      nodeEl.addEventListener("click", handler as EventListener);
      (nodeEl as HTMLElement).style.cursor = "pointer";
      cleanupFns.push(() => nodeEl.removeEventListener("click", handler as EventListener));
    });

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, [svg, onNodeClick]);

  if (!debounced.trim()) return null;
  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <span className="font-medium">Mermaid error:</span> {error}
      </div>
    );
  }
  if (!svg) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md border border-border/60 text-xs text-muted-foreground">
        Rendering diagram…
      </div>
    );
  }
  return (
    <div
      ref={containerRef}
      className={cn("docos-mermaid not-prose cursor-pointer select-none", className)}
      data-mermaid-svg
      onClick={onDiagramClick}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function svgToPngBlob(svg: string): Promise<Blob | null> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, img.width * 2);
    canvas.height = Math.max(1, img.height * 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function updateNodeContent(editor: any, getPos: any, node: any, newCode: string) {
  if (typeof getPos !== "function" || !editor) return;
  const pos = getPos();
  if (typeof pos !== "number") return;
  const tr = editor.state.tr;
  const from = pos + 1;
  const to = pos + node.nodeSize - 1;
  tr.replaceWith(from, to, editor.state.schema.text(newCode));
  editor.view.dispatch(tr);
}

function renameNodeInCode(code: string, oldName: string, newName: string): string {
  if (!oldName.trim() || !newName.trim() || oldName === newName) return code;
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "g");
  return code.replace(regex, newName);
}

function removeNodeFromCode(code: string, nodeName: string): string {
  if (!nodeName.trim()) return code;
  const lines = code.split("\n");
  const filtered = lines.filter((line) => !line.includes(nodeName));
  return filtered.join("\n");
}

function flipDiagramDirection(code: string): string {
  if (/\b(graph|flowchart)\s+LR\b/i.test(code)) {
    return code.replace(/\b(graph|flowchart)\s+LR\b/i, "$1 TD");
  }
  if (/\b(graph|flowchart)\s+TD\b/i.test(code)) {
    return code.replace(/\b(graph|flowchart)\s+TD\b/i, "$1 LR");
  }
  if (/\b(graph|flowchart)\s+TB\b/i.test(code)) {
    return code.replace(/\b(graph|flowchart)\s+TB\b/i, "$1 LR");
  }
  return code;
}

const CODE_LANGUAGES = [
  "text",
  "javascript",
  "typescript",
  "python",
  "json",
  "bash",
  "sql",
  "html",
  "css",
  "java",
  "go",
  "rust",
  "c",
  "cpp",
  "yaml",
  "markdown",
  "mermaid",
];

/**
 * Node view for code blocks with interactive clickable diagram support.
 */
export function CodeBlockView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const language = String(node.attrs.language ?? "").toLowerCase();
  const isMermaid = language === "mermaid";
  const code = node.textContent;

  const [editing, setEditing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Clickable Node Editor state
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState("");
  const [newNodeLabel, setNewNodeLabel] = useState("");

  const wrapperRef = useRef<HTMLDivElement>(null);

  const copyCode = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const downloadSvg = () => {
    const svg = wrapperRef.current?.querySelector("[data-mermaid-svg] svg");
    if (!svg) {
      toast.error("Diagram is not rendered yet");
      return;
    }
    const source = new XMLSerializer().serializeToString(svg);
    downloadBlob(new Blob([source], { type: "image/svg+xml" }), "diagram.svg");
  };

  const downloadPng = async () => {
    const svg = wrapperRef.current?.querySelector("[data-mermaid-svg] svg");
    if (!svg) {
      toast.error("Diagram is not rendered yet");
      return;
    }
    const blob = await svgToPngBlob(new XMLSerializer().serializeToString(svg));
    if (blob) downloadBlob(blob, "diagram.png");
    else toast.error("PNG export failed");
  };

  const handleSaveNodeLabel = () => {
    if (selectedNode && newNodeLabel.trim()) {
      const updated = renameNodeInCode(code, selectedNode, newNodeLabel.trim());
      updateNodeContent(editor, getPos, node, updated);
      setNodeModalOpen(false);
      toast.success(`Updated node label to "${newNodeLabel.trim()}"`);
    }
  };

  if (isMermaid) {
    return (
      <NodeViewWrapper ref={wrapperRef} className="group/mmd relative my-4">
        {/* Floating Toolbar */}
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-border/60 bg-popover/95 p-1 opacity-0 shadow-md backdrop-blur-md transition-opacity focus-within:opacity-100 group-hover/mmd:opacity-100">
          <Button
            size="icon-sm"
            variant={editing ? "default" : "ghost"}
            aria-label={editing ? "Done editing" : "Edit diagram source"}
            title={editing ? "Done editing" : "Click to edit source"}
            onClick={(e) => {
              e.stopPropagation();
              setEditing((v) => !v);
            }}
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Copy source"
            title="Copy source"
            onClick={(e) => {
              e.stopPropagation();
              copyCode();
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Download SVG"
            title="Download SVG"
            onClick={(e) => {
              e.stopPropagation();
              downloadSvg();
            }}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Download PNG"
            title="Download PNG"
            onClick={(e) => {
              e.stopPropagation();
              void downloadPng();
            }}
          >
            <ImageDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Workbench Editor"
            title="Open Interactive Workbench"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreen(true);
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Hover Click-to-Edit Pill */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-indigo-200/80 dark:border-indigo-900/80 bg-background/90 px-2.5 py-1 text-[10px] font-medium text-muted-foreground opacity-0 shadow-xs transition-opacity group-hover/mmd:opacity-100">
          <MousePointerClick className="h-3 w-3 text-primary animate-pulse" />
          <span>Click any node to edit label • Click diagram to edit source</span>
        </div>

        {/* Rendered SVG Diagram */}
        <div
          className={cn(
            "rounded-xl border p-4 transition-all duration-200",
            editing
              ? "border-primary/50 ring-2 ring-primary/20 bg-accent/20"
              : "border-border/60 hover:border-indigo-300 dark:hover:border-indigo-800 bg-card/40",
          )}
        >
          <MermaidDiagram
            code={code}
            onNodeClick={(nodeText) => {
              setSelectedNode(nodeText);
              setNewNodeLabel(nodeText);
              setNodeModalOpen(true);
            }}
            onDiagramClick={() => setEditing((v) => !v)}
          />
        </div>

        {/* Source stays mounted for ProseMirror; visible only while editing. */}
        <div className={cn("mt-2", !editing && "hidden")}>
          <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-border bg-muted/50 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-primary" />
              <span>Mermaid Source</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => {
                  const flipped = flipDiagramDirection(code);
                  updateNodeContent(editor, getPos, node, flipped);
                }}
                className="h-6 text-[10px] gap-1"
                title="Flip layout direction (LR / TD)"
              >
                <ArrowLeftRight className="h-3 w-3" />
                Flip Direction
              </Button>
            </div>
          </div>
          <pre className="!mt-0 rounded-t-none" data-language="mermaid" spellCheck={false}>
            <NodeViewContent as="code" spellCheck={false} />
          </pre>
        </div>

        {/* Node Quick Editor Dialog */}
        <Dialog open={nodeModalOpen} onOpenChange={setNodeModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-primary" />
                Edit Node Label
              </DialogTitle>
              <DialogDescription>
                Update label for node <code className="font-semibold text-foreground">{selectedNode}</code> in diagram.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="node-label">Node Text Label</Label>
                <Input
                  id="node-label"
                  value={newNodeLabel}
                  onChange={(e) => setNewNodeLabel(e.target.value)}
                  placeholder="Enter new node text..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveNodeLabel();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (selectedNode) {
                    const updated = removeNodeFromCode(code, selectedNode);
                    updateNodeContent(editor, getPos, node, updated);
                    setNodeModalOpen(false);
                    toast.success(`Removed node "${selectedNode}"`);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Node
              </Button>

              <div className="flex-1" />

              <Button variant="outline" size="sm" onClick={() => setNodeModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveNodeLabel}>
                <Check className="h-3.5 w-3.5" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Fullscreen / Interactive Diagram Workbench Modal */}
        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
          <DialogContent className="flex h-[90vh] max-w-6xl flex-col p-6">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Interactive Diagram Workbench
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={copyCode}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Code
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadSvg}>
                    <Download className="h-3.5 w-3.5" />
                    SVG
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void downloadPng()}>
                    <ImageDown className="h-3.5 w-3.5" />
                    PNG
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2 gap-4 py-3">
              {/* Left Pane: Code Editor + Quick Tools */}
              <div className="flex flex-col rounded-xl border border-border bg-muted/20 p-3 min-h-0">
                <div className="mb-2 flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5 text-primary" />
                    Source Editor
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      const flipped = flipDiagramDirection(code);
                      updateNodeContent(editor, getPos, node, flipped);
                    }}
                    className="h-6 text-[10px] gap-1"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    Flip Direction
                  </Button>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => updateNodeContent(editor, getPos, node, e.target.value)}
                  className="flex-1 font-mono text-xs leading-relaxed bg-background p-3 rounded-lg border border-border/80 outline-none resize-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter Mermaid diagram code..."
                  spellCheck={false}
                />
              </div>

              {/* Right Pane: Live Interactive SVG Preview */}
              <div className="flex flex-col rounded-xl border border-border bg-card p-4 min-h-0 overflow-auto">
                <div className="mb-2 flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MousePointerClick className="h-3.5 w-3.5 text-primary animate-pulse" />
                    Live Clickable Preview
                  </span>
                  <span className="text-[11px] text-muted-foreground">Click any node to rename</span>
                </div>
                <div className="flex-1 flex items-center justify-center overflow-auto p-4 [&_svg]:mx-auto [&_svg]:max-w-full">
                  <MermaidDiagram
                    code={code}
                    onNodeClick={(nodeText) => {
                      setSelectedNode(nodeText);
                      setNewNodeLabel(nodeText);
                      setNodeModalOpen(true);
                    }}
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="group/code">
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-border bg-muted/50 px-3 py-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Code language"
              className="flex cursor-pointer items-center gap-1 bg-transparent text-[10px] font-medium uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:text-foreground"
            >
              <span>{language || "text"}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
            {CODE_LANGUAGES.map((l) => (
              <DropdownMenuItem
                key={l}
                onSelect={() => updateAttributes({ language: l === "text" ? null : l })}
                className="flex cursor-pointer items-center justify-between text-[11px] uppercase tracking-wide"
              >
                <span>{l}</span>
                {(language || "text") === l && <Check className="h-3 w-3 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={copyCode}
          aria-label="Copy code"
          className="flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/code:opacity-100"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="!mt-0 rounded-t-none" data-language={language || undefined} spellCheck={false}>
        <NodeViewContent as="code" spellCheck={false} />
      </pre>
    </NodeViewWrapper>
  );
}
