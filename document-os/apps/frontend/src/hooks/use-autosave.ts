import type { Section } from "@documentos/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { ApiClientError, sectionApi } from "@/lib/api-client";

export type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

const DRAFT_KEY = (sectionId: string) => `docos-draft-${sectionId}`;

export interface LocalDraft {
  content: string;
  savedAt: string; // ISO of local save
}

export function readLocalDraft(sectionId: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(sectionId));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(sectionId: string) {
  localStorage.removeItem(DRAFT_KEY(sectionId));
}

/**
 * Debounced autosave for a section's markdown content.
 * - Queues to localStorage when offline / on network failure, retries on reconnect.
 * - Handles 409 conflicts gracefully with a reload toast.
 */
export function useAutosave(sectionId: string, documentId: string, intervalMs = 1500) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const pendingRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  const persist = useCallback(
    async (content: string) => {
      if (savingRef.current) {
        pendingRef.current = content;
        return;
      }
      savingRef.current = true;
      setState("saving");
      try {
        const updated = await sectionApi.putContent(sectionId, { content, source: "manual" });
        clearLocalDraft(sectionId);
        setState("saved");
        setLastSavedAt(new Date());
        // Sync the section inside the cached document without a refetch.
        queryClient.setQueryData<{ sections?: Section[] }>(["document", documentId], (old) =>
          old?.sections
            ? { ...old, sections: old.sections.map((s) => (s.id === sectionId ? { ...s, ...updated } : s)) }
            : old,
        );
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 409) {
          setState("error");
          toast.error("This section was modified elsewhere", {
            action: {
              label: "Reload",
              onClick: () => queryClient.invalidateQueries({ queryKey: ["document", documentId] }),
            },
            duration: 8000,
          });
        } else if (err instanceof ApiClientError && (err.status === 0 || err.status >= 500)) {
          // Offline / server down — stash locally, retry on reconnect.
          localStorage.setItem(DRAFT_KEY(sectionId), JSON.stringify({ content, savedAt: new Date().toISOString() }));
          setState("offline");
        } else {
          setState("error");
          toast.error(err instanceof ApiClientError ? err.message : "Failed to save");
        }
      } finally {
        savingRef.current = false;
        if (pendingRef.current !== null) {
          const next = pendingRef.current;
          pendingRef.current = null;
          void persist(next);
        }
      }
    },
    [sectionId, documentId, queryClient],
  );

  const debouncedSave = useDebouncedCallback(persist, intervalMs);

  const save = useCallback(
    (content: string) => {
      setState((s) => (s === "offline" ? s : "saving"));
      debouncedSave(content);
    },
    [debouncedSave],
  );

  // Retry queued draft when connectivity returns.
  useEffect(() => {
    const onOnline = () => {
      const draft = readLocalDraft(sectionId);
      if (draft) void persist(draft.content);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sectionId, persist]);

  // Flush pending save on unmount.
  useEffect(() => () => debouncedSave.cancel(), [debouncedSave]);

  return { state, save, lastSavedAt };
}
