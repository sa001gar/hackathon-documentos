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

/**
 * Marked renders GFM checkboxes as `<li><input type="checkbox">…` while the
 * editor's TaskItem extension only parses its own `data-type` markup. Rewrite
 * the marked output so task lists load as real task items.
 */
function upgradeTaskLists(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("li > input[type='checkbox']").forEach((input) => {
    const li = input.parentElement;
    if (!li) return;
    li.setAttribute("data-type", "taskItem");
    li.setAttribute("data-checked", input.hasAttribute("checked") ? "true" : "false");
    input.remove();
    const ul = li.closest("ul");
    if (ul) ul.setAttribute("data-type", "taskList");
  });
  return doc.body.innerHTML;
}

/** Markdown → editor HTML. */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  const html = marked.parse(preprocessMarkdown(markdown), { async: false });
  return typeof html === "string" ? upgradeTaskLists(html) : "";
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

  // Editor task items → GFM checkboxes (the gfm rule misses TipTap's label-wrapped input).
  td.addRule("taskItem", {
    filter: (node) =>
      node.nodeName === "LI" && (node as HTMLElement).getAttribute("data-type") === "taskItem",
    replacement: (content, node, options) => {
      const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
      const cleaned = content.replace(/^\n+/, "").replace(/\n+$/, "").replace(/\n/gm, "\n    ");
      const prefix = `${options.bulletListMarker} ${checked ? "[x]" : "[ ]"} `;
      return prefix + cleaned + "\n";
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
