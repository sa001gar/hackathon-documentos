import { cn } from "@documentos/utils";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Code2, Copy, Download, ImageDown, Maximize2, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useTheme } from "@/hooks/use-theme";

let mermaidSeq = 0;

/** Renders a mermaid source string as an SVG diagram (debounced). Mermaid's ~679KB is lazy-loaded. */
export function MermaidDiagram({ code, className }: { code: string; className?: string }) {
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
      className={cn("docos-mermaid not-prose", className)}
      data-mermaid-svg
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

const CODE_LANGUAGES = [
  "text", "javascript", "typescript", "python", "json", "bash", "sql", "html", "css",
  "java", "go", "rust", "c", "cpp", "yaml", "markdown", "mermaid",
];

/**
 * Node view for code blocks.
 *
 * - Mermaid blocks render as a diagram by default (source hidden). A hover
 *   toolbar offers: edit source, copy, download SVG/PNG, fullscreen.
 * - Other languages get a header bar with a language selector + copy button.
 *
 * Serialization stays `<pre><code class="language-x">` so markdown round-trips.
 */
export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const language = String(node.attrs.language ?? "").toLowerCase();
  const isMermaid = language === "mermaid";
  const code = node.textContent;

  const [editing, setEditing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  if (isMermaid) {
    return (
      <NodeViewWrapper ref={wrapperRef} className="group/mmd relative">
        <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border border-border/60 bg-popover/95 p-0.5 opacity-0 shadow-sm transition-opacity focus-within:opacity-100 group-hover/mmd:opacity-100">
          <Button
            size="icon-sm" variant="ghost"
            aria-label={editing ? "Done editing" : "Edit diagram source"}
            title={editing ? "Done editing" : "Edit diagram source"}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Copy source" title="Copy source" onClick={copyCode}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Download SVG" title="Download SVG" onClick={downloadSvg}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Download PNG" title="Download PNG" onClick={() => void downloadPng()}>
            <ImageDown className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Fullscreen" title="Fullscreen" onClick={() => setFullscreen(true)}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <MermaidDiagram code={code} />

        {/* Source stays mounted for ProseMirror; visible only while editing. */}
        <div className={cn("mt-1", !editing && "hidden")}>
          <div className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-border bg-muted/50 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <Code2 className="h-3 w-3" />
            mermaid source
          </div>
          <pre className="!mt-0 rounded-t-none" data-language="mermaid">
            <NodeViewContent as="code" />
          </pre>
        </div>

        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
          <DialogContent className="flex h-[85vh] max-w-5xl flex-col">
            <DialogHeader>
              <DialogTitle>Diagram</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card p-6 [&_svg]:mx-auto">
              <MermaidDiagram code={code} />
            </div>
          </DialogContent>
        </Dialog>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="group/code">
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-border bg-muted/50 px-3 py-1">
        <select
          value={language || "text"}
          onChange={(e) => updateAttributes({ language: e.target.value === "text" ? null : e.target.value })}
          aria-label="Code language"
          className="cursor-pointer bg-transparent text-[10px] font-medium uppercase tracking-wide text-muted-foreground outline-none hover:text-foreground"
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
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
      <pre className="!mt-0 rounded-t-none" data-language={language || undefined}>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
