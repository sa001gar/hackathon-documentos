import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;
  setRightCollapsed: (v: boolean) => void;
  leftSize: number;
  rightSize: number;
  setLeftSize: (v: number) => void;
  setRightSize: (v: number) => void;
  lastDocumentId: string | null;
  setLastDocumentId: (id: string | null) => void;
  lastWorkspaceId: string | null;
  setLastWorkspaceId: (id: string | null) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
      leftCollapsed: false,
      rightCollapsed: false,
      setLeftCollapsed: (leftCollapsed) => set({ leftCollapsed }),
      setRightCollapsed: (rightCollapsed) => set({ rightCollapsed }),
      leftSize: 20,
      rightSize: 22,
      setLeftSize: (leftSize) => set({ leftSize }),
      setRightSize: (rightSize) => set({ rightSize }),
      lastDocumentId: null,
      setLastDocumentId: (lastDocumentId) => set({ lastDocumentId }),
      lastWorkspaceId: null,
      setLastWorkspaceId: (lastWorkspaceId) => set({ lastWorkspaceId }),
      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    }),
    {
      name: "docos-ui",
      partialize: (s) => ({
        theme: s.theme,
        leftCollapsed: s.leftCollapsed,
        rightCollapsed: s.rightCollapsed,
        leftSize: s.leftSize,
        rightSize: s.rightSize,
        lastDocumentId: s.lastDocumentId,
        lastWorkspaceId: s.lastWorkspaceId,
      }),
    },
  ),
);
