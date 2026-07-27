import type { Section } from "@documentos/shared-types";
import { cn } from "@documentos/utils";
import { EditorContent, useEditor } from "@tiptap/react";
import { CloudOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  clearLocalDraft,
  readLocalDraft,
  useAutosave,
  type LocalDraft,
} from "@/hooks/use-autosave";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown";
import { AiToolbar } from "./ai-toolbar";
import { useEditorStore } from "./editor-store";
import { createSectionExtensions } from "./extensions";

interface SectionEditorProps {
  section: Section;
  documentId: string;
  autosaveInterval: number;
}

/**
 * Per-section TipTap editor with debounced autosave, offline draft recovery
 * and guarded external-content sync (AI generation / version restores update
 * the query cache; typing is never clobbered).
 */
export function SectionEditor({ section, documentId, autosaveInterval }: SectionEditorProps) {
  const reportSaveState = useEditorStore((s) => s.reportSaveState);
  const setActiveEditor = useEditorStore((s) => s.setActiveEditor);
  const { state: saveState, save, lastSavedAt } = useAutosave(section.id, documentId, autosaveInterval);

  const extensions = useMemo(() => createSectionExtensions(), []);
  // Initial content is computed once — later updates flow through the sync effect.
  const initialHtml = useMemo(() => markdownToHtml(section.content), [section.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastContentRef = useRef(section.content);
  const saveRef = useRef(save);
  saveRef.current = save;

  const [draft, setDraft] = useState<LocalDraft | null>(null);

  const editor = useEditor(
    {
      extensions,
      content: initialHtml,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          class: "docos-editor px-1 py-2 text-[14px] leading-relaxed focus:outline-none",
          spellcheck: "false",
        },
      },
      onUpdate: ({ editor: e }) => {
        const md = htmlToMarkdown(e.getHTML());
        lastContentRef.current = md;
        if (useEditorStore.getState().autoSaveEnabled) {
          saveRef.current(md);
        }
      },
      onFocus: ({ editor: e }) => {
        setActiveEditor(e, section.id, section.title);
      },
    },
    [section.id],
  );

  // Report save state up to the document header indicator.
  useEffect(() => {
    reportSaveState(section.id, saveState, lastSavedAt ? lastSavedAt.getTime() : null);
  }, [saveState, lastSavedAt, section.id, reportSaveState]);

  // External content changes (AI generation, version restore, template apply)
  // arrive via the query cache. Typing updates lastContentRef first, so our own
  // saves never echo back into the editor.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (section.content === lastContentRef.current && section.content === htmlToMarkdown(editor.getHTML())) return;
    lastContentRef.current = section.content;
    editor.commands.setContent(markdownToHtml(section.content), false);
  }, [section.content, section.updated_at, editor]);

  // Offer to recover an offline draft that never reached the server.
  useEffect(() => {
    const local = readLocalDraft(section.id);
    if (local && local.content.trim() && local.content.trim() !== section.content.trim()) {
      setDraft(local);
    }
    // Only on mount / section change.
  }, [section.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [aiUpdated, setAiUpdated] = useState(false);

  const persistNow = () => {
    if (!editor || editor.isDestroyed) return;
    const md = htmlToMarkdown(editor.getHTML());
    lastContentRef.current = md;
    saveRef.current(md);
  };

  const handleAiApplied = () => {
    persistNow();
    setAiUpdated(true);
    setTimeout(() => setAiUpdated(false), 2200);
  };

  return (
    <div
      className={cn(
        "relative rounded-xl transition-all duration-500",
        aiUpdated && "ring-2 ring-[#5551FF]/80 bg-[#5551FF]/5 dark:bg-[#5551FF]/15 shadow-[0_0_25px_rgba(85,81,255,0.3)] animate-pulse",
      )}
    >
      {draft && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <CloudOff className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="min-w-0 flex-1 text-amber-600 dark:text-amber-400">
            An unsaved offline draft exists for this section.
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              if (editor && !editor.isDestroyed) {
                editor.commands.setContent(markdownToHtml(draft.content), true);
                persistNow();
              }
              clearLocalDraft(section.id);
              setDraft(null);
            }}
          >
            Restore
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              clearLocalDraft(section.id);
              setDraft(null);
            }}
          >
            Dismiss
          </Button>
        </div>
      )}
      <EditorContent editor={editor} className="docos-editor" />
      {editor && !editor.isDestroyed && (
        <AiToolbar editor={editor} sectionId={section.id} documentId={documentId} onApplied={handleAiApplied} />
      )}
    </div>
  );
}
