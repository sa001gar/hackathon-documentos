import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Section, SectionNode } from "@documentos/shared-types";

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Build a hierarchical tree from the API's flat, ordered section list. */
export function buildSectionTree(sections: Section[]): SectionNode[] {
  const byId = new Map<string, SectionNode>();
  const roots: SectionNode[] = [];
  for (const s of sections) byId.set(s.id, { ...s, children: [] });
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: SectionNode[]) => {
    nodes.sort((a, b) => a.order_index - b.order_index);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** Flatten a section tree depth-first (for outline rendering / markdown export). */
export function flattenTree(nodes: SectionNode[], depth = 0): { node: SectionNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
}

/** Render a section tree to a single markdown document (headings by depth). */
export function treeToMarkdown(nodes: SectionNode[], title?: string): string {
  const parts: string[] = [];
  if (title) parts.push(`# ${title}\n`);
  for (const { node, depth } of flattenTree(nodes)) {
    const level = Math.min(depth + (title ? 2 : 1), 6);
    parts.push(`${"#".repeat(level)} ${node.title}\n`);
    if (node.content.trim()) parts.push(node.content.trim() + "\n");
  }
  return parts.join("\n");
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Simple promise-based debounce for autosave. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

export const STATUS_COLORS: Record<string, string> = {
  pending: "text-zinc-400",
  generating: "text-indigo-400",
  draft: "text-amber-400",
  reviewed: "text-sky-400",
  validated: "text-emerald-400",
  error: "text-red-400",
};
