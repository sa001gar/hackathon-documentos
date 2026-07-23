import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useTheme } from "@/hooks/use-theme";

let mermaidSeq = 0;

/** Renders a mermaid code block's source as an SVG diagram (debounced). */
function MermaidDiagram({ code }: { code: string }) {
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
    mermaid.initialize({
      startOnLoad: false,
      theme: resolvedTheme === "dark" ? "dark" : "default",
      securityLevel: "strict",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    });
    mermaid
      .render(renderId, source)
      .then(({ svg: rendered }) => {
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        // Mermaid leaves a stray error element in the DOM on parse failures.
        document.getElementById(`d${renderId}`)?.remove();
        document.getElementById(renderId)?.remove();
        if (!cancelled) {
          setSvg(null);
          setError(
            err instanceof Error ? err.message.replace(/\n+/g, " ").slice(0, 200) : "Invalid diagram syntax",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, resolvedTheme]);

  if (!debounced.trim()) return null;
  if (error) {
    return (
      <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <span className="font-medium">Mermaid error:</span> {error}
      </div>
    );
  }
  if (!svg) {
    return (
      <div className="mb-2 flex h-16 items-center justify-center rounded-md border border-border/60 text-xs text-muted-foreground">
        Rendering diagram…
      </div>
    );
  }
  return <div className="docos-mermaid not-prose" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/**
 * Node view for code blocks. `mermaid` blocks get a live diagram preview
 * above the editable source; everything else renders as a plain code block.
 * Serialization stays `<pre><code class="language-x">` so markdown round-trips.
 */
export function CodeBlockView({ node }: NodeViewProps) {
  const language = String(node.attrs.language ?? "").toLowerCase();
  const isMermaid = language === "mermaid";

  return (
    <NodeViewWrapper>
      {isMermaid && <MermaidDiagram code={node.textContent} />}
      <pre className={isMermaid ? "mt-1" : undefined} data-language={language || undefined}>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
