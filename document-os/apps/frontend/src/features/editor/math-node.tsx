import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@documentos/utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      /** Insert an inline math atom (KaTeX). */
      insertMath: (attrs?: { tex?: string; display?: string }) => ReturnType;
    };
  }
}

function MathView({ node, updateAttributes, selected }: NodeViewProps) {
  const tex = String(node.attrs.tex ?? "");
  const display = node.attrs.display === "block";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tex);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const html = useMemo(() => {
    if (!tex.trim()) return "";
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false });
    } catch {
      return "";
    }
  }, [tex, display]);

  const commit = () => {
    updateAttributes({ tex: draft.trim() });
    setEditing(false);
  };

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="inline-block">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-48 rounded border border-ring bg-background px-1.5 py-0.5 font-mono text-[0.85em] outline-none"
          placeholder="TeX expression"
          aria-label="Edit TeX expression"
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      onDoubleClick={() => {
        setDraft(tex);
        setEditing(true);
      }}
      title="Double-click to edit TeX"
      className={cn(
        "docos-math-inline cursor-pointer rounded px-0.5 transition-colors hover:bg-accent",
        selected && "bg-accent ring-1 ring-ring",
      )}
    >
      {html ? (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span className="rounded bg-muted px-1 font-mono text-[0.8em] text-muted-foreground">
          empty math
        </span>
      )}
    </NodeViewWrapper>
  );
}

/**
 * Inline math atom. Parses `<span data-math data-tex="...">` produced by
 * lib/markdown's preprocessing and serializes back to the same shape so the
 * turndown "math" rule restores `$...$` / `$$...$$` on save.
 */
export const MathNode = Node.create({
  name: "math",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      tex: { default: "" },
      display: { default: "inline" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-math]",
        getAttrs: (el) => ({
          tex: (el as HTMLElement).getAttribute("data-tex") ?? "",
          display: (el as HTMLElement).getAttribute("data-display") ?? "inline",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-math": "",
        "data-tex": String(node.attrs.tex ?? ""),
        "data-display": String(node.attrs.display ?? "inline"),
        class: "docos-math",
      }),
    ];
  },

  addCommands() {
    return {
      insertMath:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },
});
