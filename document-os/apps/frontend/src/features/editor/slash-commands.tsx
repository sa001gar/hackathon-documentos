import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Sigma,
  Table,
  Workflow,
} from "lucide-react";
import { SlashMenu, type SlashItem, type SlashMenuHandle } from "./slash-menu";

const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Heading 1",
    description: "Large section heading",
    keywords: ["h1", "title"],
    icon: Heading1,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    keywords: ["h2", "subtitle"],
    icon: Heading2,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    keywords: ["h3"],
    icon: Heading3,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    description: "Unordered list",
    keywords: ["ul", "unordered", "points"],
    icon: List,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "Ordered list",
    keywords: ["ol", "ordered", "numbers"],
    icon: ListOrdered,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Task list",
    description: "Checkable to-do items",
    keywords: ["todo", "checkbox", "tasks"],
    icon: ListTodo,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Table",
    description: "3 × 3 table with header",
    keywords: ["grid", "rows", "columns"],
    icon: Table,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Code block",
    description: "Syntax-highlighted code",
    keywords: ["code", "snippet", "pre"],
    icon: Code2,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("codeBlock").run(),
  },
  {
    title: "Mermaid diagram",
    description: "Flowchart rendered from code",
    keywords: ["diagram", "flowchart", "graph"],
    icon: Workflow,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "codeBlock",
          attrs: { language: "mermaid" },
          content: [{ type: "text", text: "graph TD\n  A[Start] --> B[Done]" }],
        })
        .run(),
  },
  {
    title: "Math",
    description: "Inline KaTeX expression",
    keywords: ["tex", "katex", "equation", "formula"],
    icon: Sigma,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertContent({ type: "math", attrs: { tex: "E = mc^2", display: "inline" } }).run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    keywords: ["hr", "separator", "rule"],
    icon: Minus,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "Image",
    description: "Embed from a URL",
    keywords: ["picture", "photo", "media"],
    icon: Image,
    command: ({ editor, range }) => {
      const url = window.prompt("Image URL");
      const chain = editor.chain().focus().deleteRange(range);
      if (url?.trim()) chain.setImage({ src: url.trim(), alt: "" });
      chain.run();
    },
  },
];

function filterItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) || item.keywords.some((k) => k.toLowerCase().includes(q)),
  ).slice(0, 10);
}

/** "/" block menu — suggestion plugin with a hand-positioned React popup. */
export const SlashCommands = Extension.create({
  name: "slashCommands",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterItems(query),
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle> | null = null;
          let popup: HTMLDivElement | null = null;

          const position = (props: SuggestionProps<SlashItem>) => {
            if (!popup || !props.clientRect) return;
            const rect = props.clientRect();
            if (!rect) return;
            popup.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
            popup.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 320)}px`;
          };

          const cleanup = () => {
            renderer?.destroy();
            popup?.remove();
            renderer = null;
            popup = null;
          };

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, { props, editor: props.editor });
              popup = document.createElement("div");
              popup.style.position = "fixed";
              popup.style.zIndex = "50";
              popup.appendChild(renderer.element);
              document.body.appendChild(popup);
              position(props);
            },
            onUpdate: (props) => {
              renderer?.updateProps(props);
              position(props);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") {
                cleanup();
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => cleanup(),
          };
        },
      }),
    ];
  },
});
