import type { Editor } from "@tiptap/core";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "@documentos/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorStore } from "./editor-store";

interface Item {
  icon: typeof Bold;
  label: string;
  run: (e: Editor) => void;
  active?: (e: Editor) => boolean;
  canRun?: (e: Editor) => boolean;
}

const ITEMS: (Item | "divider")[] = [
  { icon: Undo2, label: "Undo", run: (e) => e.chain().focus().undo().run(), canRun: (e) => e.can().undo() },
  { icon: Redo2, label: "Redo", run: (e) => e.chain().focus().redo().run(), canRun: (e) => e.can().redo() },
  "divider",
  { icon: Bold, label: "Bold", run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive("bold") },
  { icon: Italic, label: "Italic", run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive("italic") },
  { icon: Underline, label: "Underline", run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive("underline") },
  { icon: Strikethrough, label: "Strikethrough", run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive("strike") },
  { icon: Code, label: "Inline code", run: (e) => e.chain().focus().toggleCode().run(), active: (e) => e.isActive("code") },
  "divider",
  { icon: Heading1, label: "Heading 1", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), active: (e) => e.isActive("heading", { level: 1 }) },
  { icon: Heading2, label: "Heading 2", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive("heading", { level: 2 }) },
  { icon: Heading3, label: "Heading 3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive("heading", { level: 3 }) },
  "divider",
  { icon: List, label: "Bullet list", run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive("bulletList") },
  { icon: ListOrdered, label: "Numbered list", run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive("orderedList") },
  { icon: ListTodo, label: "Task list", run: (e) => e.chain().focus().toggleTaskList().run(), active: (e) => e.isActive("taskList") },
  { icon: Quote, label: "Quote", run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive("blockquote") },
  "divider",
  {
    icon: Link2,
    label: "Link",
    run: (e) => {
      const prev = e.getAttributes("link").href as string | undefined;
      const url = window.prompt("Link URL", prev ?? "https://");
      if (url === null) return;
      if (!url.trim()) e.chain().focus().unsetLink().run();
      else e.chain().focus().setLink({ href: url.trim() }).run();
    },
    active: (e) => e.isActive("link"),
  },
  {
    icon: Image,
    label: "Image",
    run: (e) => {
      const url = window.prompt("Image URL");
      if (url?.trim()) e.chain().focus().setImage({ src: url.trim() }).run();
    },
  },
  {
    icon: Table,
    label: "Table",
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  { icon: Minus, label: "Divider", run: (e) => e.chain().focus().setHorizontalRule().run() },
];

/**
 * Persistent formatting toolbar above the canvas. Commands target the
 * last-focused section editor (tracked in the editor store), so it behaves
 * like a normal word processor toolbar despite per-section editors.
 */
export function EditorToolbar() {
  const activeEditor = useEditorStore((s) => s.activeEditor);

  return (
    <div className="flex h-9 w-full items-center gap-0.5 border-b border-border/60 bg-muted/30 px-3 overflow-x-auto min-w-0 flex-nowrap backdrop-blur-sm">
      {ITEMS.map((item, i) =>
        item === "divider" ? (
          <div key={`d${i}`} className="mx-1.5 h-4 w-px shrink-0 bg-border/60" aria-hidden />
        ) : (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={item.label}
                disabled={!activeEditor || (item.canRun ? !item.canRun(activeEditor) : false)}
                onMouseDown={(e) => {
                  // Keep editor focus while clicking toolbar buttons.
                  e.preventDefault();
                  if (activeEditor) item.run(activeEditor);
                }}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
                  "hover:bg-accent hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent",
                  activeEditor && item.active?.(activeEditor) && "bg-accent text-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{item.label}</TooltipContent>
          </Tooltip>
        ),
      )}
      {!activeEditor && (
        <span className="ml-2 text-[11px] text-muted-foreground/60">
          Click into a section to format
        </span>
      )}
    </div>
  );
}
