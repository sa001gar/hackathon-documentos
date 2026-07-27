import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

function escapeHtml(s?: string): string {
  if (typeof s !== "string") return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s?: string): string {
  if (typeof s !== "string") return "";
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function hastToHtml(node: any): string {
  if (node.type === "text") return escapeHtml(node.value);
  if (node.type === "element") {
    const cls = (node.properties?.className || []).join(" ");
    const children = (node.children || []).map(hastToHtml).join("");
    return `<span class="${cls}">${children}</span>`;
  }
  if (node.children) return node.children.map(hastToHtml).join("");
  return "";
}

function highlightCode(code: string, lang?: string): string {
  const cleanLang = (lang || "").trim().toLowerCase();
  if (!cleanLang || cleanLang === "text" || cleanLang === "plain" || cleanLang === "mermaid") {
    return escapeHtml(code);
  }
  try {
    const tree = lowlight.highlight(cleanLang, code);
    return hastToHtml(tree);
  } catch {
    return escapeHtml(code);
  }
}

marked.setOptions({ gfm: true, breaks: false });
marked.use({
  renderer: {
    code(code: string, infostring?: string) {
      const language = (infostring || "").split(/\s+/)[0];
      const highlighted = highlightCode(code, language);
      const langClass = language ? ` class="language-${escapeAttr(language)}"` : "";
      return `<pre><code${langClass}>${highlighted}</code></pre>\n`;
    },
  },
});

/** Pre-process markdown so constructs TipTap doesn't natively know survive the round-trip. */
function preprocessMarkdown(md: string): string {
  // Inline/block math: $...$ / $$...$$ → spans our math extension understands.
  // The TeX source is ALSO included as text content: turndown drops empty
  // inline elements as "blank", and keeping the source visible is a safe
  // fallback if any consumer skips the math rule. MathNode ignores the
  // content on parse (atom) and re-serializes the same shape.
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
      .replace(/\$\$([^$]+)\$\$/g, (_m, tex: string) => `<span data-math data-display="block" data-tex="${escapeAttr(tex)}">${escapeHtml(tex)}</span>`)
      .replace(/\$([^$\n]+)\$/g, (_m, tex: string) => `<span data-math data-tex="${escapeAttr(tex)}">${escapeHtml(tex)}</span>`);
  });
  return out.join("\n");
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

/**
 * Lightweight markdown → HTML for live streaming previews. Uses the SAME
 * marked parser + math preprocessing as the full pipeline (so streaming and
 * editor agree), skipping only the task-list DOMParser upgrade — math spans
 * are rendered to KaTeX by the preview component.
 */
export function markdownToHtmlFast(markdown: string): string {
  if (!markdown.trim()) return "";
  const html = marked.parse(preprocessMarkdown(markdown), { async: false });
  return typeof html === "string" ? html : "";
}

/** Plain word count for streamed/generated text. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Editor HTML → markdown (source of truth). */
export function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    hr: "---",
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
