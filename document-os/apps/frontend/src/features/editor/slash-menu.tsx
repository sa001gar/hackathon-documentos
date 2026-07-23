import type { Editor, Range } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@documentos/utils";

export interface SlashItem {
  title: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  command: (props: { editor: Editor; range: Range }) => void;
}

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashMenuProps {
  items: SlashItem[];
  query: string;
  command: (item: SlashItem) => void;
}

/** Keyboard-navigable dropdown rendered by the slash-command suggestion. */
export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { items, command },
  ref,
) {
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === "ArrowUp") {
        setIndex((i) => (i + items.length - 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "ArrowDown") {
        setIndex((i) => (i + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "Enter") {
        const item = items[index];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-64 rounded-lg border border-border bg-popover p-3 text-xs text-muted-foreground shadow-lg">
        No matching blocks
      </div>
    );
  }

  return (
    <div className="w-64 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg">
      {items.map((item, i) => (
        <button
          key={item.title}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            command(item);
          }}
          onMouseEnter={() => setIndex(i)}
          className={cn(
            "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left",
            i === index && "bg-accent",
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40">
            <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium">{item.title}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
});
