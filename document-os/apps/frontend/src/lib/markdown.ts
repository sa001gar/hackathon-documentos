import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

marked.setOptions({ gfm: true, breaks: false });

/** Pre-process markdown so constructs TipTap doesn't natively know survive the round-trip. */
function preprocessMarkdown(md: string): string {
  // Inline/block math: $...$ / $$...$$ → spans our math extension understands.
  // Avoid touching code fences.
  const lines = md.split("\n");
  let inFence = false;
  const out = lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    return line
      .replace(/\$\$([^$]+)\$\$/g, (_m, tex: string) => `<span data-math data-display="block" data-tex="${escapeAttr(tex)}"></span>`)
      .replace(/\$([^$\n]+)\$/g, (_m, tex: string) => `<span data-math data-tex="${escapeAttr(tex)}"></span>`);
  });
  return out.join("\n");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Markdown → editor HTML. */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  const html = marked.parse(preprocessMarkdown(markdown), { async: false });
  return typeof html === "string" ? html : "";
}

/** Editor HTML → markdown (source of truth). */
export function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
  });
  td.use(gfm);

  // Preserve mermaid fences verbatim (our node view renders them as diagrams).
  td.addRule("mermaid", {
    filter: (node) =>
      node.nodeName === "PRE" &&
      (node.querySelector("code")?.getAttribute("class") ?? "").includes("language-mermaid"),
    replacement: (_content, node) => {
      const code = (node as HTMLElement).textContent ?? "";
      return `\n\n\`\`\`mermaid\n${code.replace(/\n+$/, "")}\n\`\`\`\n\n`;
    },
  });

  // Math spans back to $...$ / $$...$$
  td.addRule("math", {
    filter: (node) => node.nodeName === "SPAN" && (node as HTMLElement).hasAttribute("data-math"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const tex = el.getAttribute("data-tex") ?? el.textContent ?? "";
      return el.getAttribute("data-display") === "block" ? `$$${tex}$$` : `$${tex}$`;
    },
  });

  // Underline has no markdown equivalent — keep HTML so it round-trips.
  td.keep(["u"]);

  return td.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
}

/** Strip markdown to plain text (snippets, previews). */
export function markdownToText(markdown: string): string {
  const html = markdownToHtml(markdown);
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
}
