import { create } from "zustand";

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
  /** Lightweight conversation thread attached to the current document. */
  thread: ThreadMsg[];
  push: (role: ThreadMsg["role"], text: string) => void;
  clearThread: () => void;
  threadOpen: boolean;
  setThreadOpen: (open: boolean) => void;
}

let seq = 0;
const MAX_THREAD = 50;

export const useComposerStore = create<ComposerStore>()((set) => ({
  focusNonce: 0,
  requestFocus: () => set((s) => ({ focusNonce: s.focusNonce + 1 })),
  thread: [],
  push: (role, text) =>
    set((s) => ({
      thread: [...s.thread, { id: ++seq, role, text, at: Date.now() }].slice(-MAX_THREAD),
      threadOpen: true,
    })),
  clearThread: () => set({ thread: [], threadOpen: false }),
  threadOpen: false,
  setThreadOpen: (threadOpen) => set({ threadOpen }),
}));
