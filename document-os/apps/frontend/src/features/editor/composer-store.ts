import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ThreadMsg {
  id: number;
  role: "user" | "ai";
  text: string;
  at: number;
}

interface ComposerStore {
  /** Incremented to ask the composer to grab focus (e.g. from EmptyState). */
  focusNonce: number;
  requestFocus: () => void;
  /** Conversation threads keyed by documentId. */
  threads: Record<string, ThreadMsg[]>;
  /** Get thread for a specific documentId. */
  getThread: (documentId: string) => ThreadMsg[];
  /** Push a message to a document's prompt history. */
  pushDoc: (documentId: string, role: ThreadMsg["role"], text: string) => void;
  /** Flat fallback thread for current active document. */
  thread: ThreadMsg[];
  push: (role: ThreadMsg["role"], text: string) => void;
  clearThread: (documentId?: string) => void;
  threadOpen: boolean;
  setThreadOpen: (open: boolean) => void;
}

let seq = Date.now();
const MAX_THREAD = 50;

export const useComposerStore = create<ComposerStore>()(
  persist(
    (set, get) => ({
      focusNonce: 0,
      requestFocus: () => set((s) => ({ focusNonce: s.focusNonce + 1 })),
      threads: {},
      getThread: (documentId: string) => get().threads[documentId] ?? get().thread ?? [],
      pushDoc: (documentId, role, text) =>
        set((s) => {
          const current = s.threads[documentId] ?? [];
          const updated = [...current, { id: ++seq, role, text, at: Date.now() }].slice(-MAX_THREAD);
          return {
            threads: { ...s.threads, [documentId]: updated },
            thread: updated,
            threadOpen: true,
          };
        }),
      thread: [],
      push: (role, text) =>
        set((s) => {
          const updated = [...s.thread, { id: ++seq, role, text, at: Date.now() }].slice(-MAX_THREAD);
          return {
            thread: updated,
            threadOpen: true,
          };
        }),
      clearThread: (documentId) =>
        set((s) => {
          if (documentId && s.threads[documentId]) {
            const nextThreads = { ...s.threads };
            delete nextThreads[documentId];
            return { threads: nextThreads, thread: [], threadOpen: false };
          }
          return { thread: [], threadOpen: false };
        }),
      threadOpen: false,
      setThreadOpen: (threadOpen) => set({ threadOpen }),
    }),
    {
      name: "docos-prompt-history",
      partialize: (state) => ({ threads: state.threads }),
    },
  ),
);
