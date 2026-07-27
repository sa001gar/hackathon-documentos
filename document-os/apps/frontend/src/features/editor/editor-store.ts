import type { ReviewReport, ValidationReport } from "@documentos/shared-types";
import type { Editor } from "@tiptap/core";
import { create } from "zustand";
import type { SaveState } from "@/hooks/use-autosave";

export type InspectorTab = "outline" | "prompts" | "review";
export type EditorAction = "export";

interface SectionSaveInfo {
  state: SaveState;
  savedAt: number | null;
}

/**
 * Per-document editor UI state shared between the center canvas (editor page)
 * and the right inspector / slide-over panels (which live in the app shell).
 * Document-generation pipeline state lives in ./generation-store.
 */
interface EditorUiState {
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  scrollTarget: string | null;
  setScrollTarget: (id: string | null) => void;
  inspectorTab: InspectorTab;
  setInspectorTab: (tab: InspectorTab) => void;
  requestedAction: EditorAction | null;
  requestAction: (action: EditorAction) => void;
  clearRequestedAction: () => void;
  validateRunId: number;
  reviewRunId: number;
  requestValidate: () => void;
  requestReview: () => void;
  versionsSectionId: string | null;
  setVersionsSectionId: (id: string | null) => void;
  saveStates: Record<string, SectionSaveInfo>;
  reportSaveState: (sectionId: string, state: SaveState, savedAt: number | null) => void;
  resetSaveStates: () => void;
  /** Last focused TipTap instance — the top formatting toolbar targets it. */
  activeEditor: Editor | null;
  activeSectionId: string | null;
  activeSectionTitle: string | null;
  setActiveEditor: (editor: Editor | null, sectionId?: string, sectionTitle?: string) => void;
  /** Clear the section context chip (composer ✕, document switch). */
  clearSectionContext: () => void;
  validations: Record<string, ValidationReport>;
  setValidation: (documentId: string, report: ValidationReport) => void;
  reviews: Record<string, ReviewReport>;
  setReview: (documentId: string, report: ReviewReport) => void;
}

export const useEditorStore = create<EditorUiState>()((set) => ({
  autoSaveEnabled: true,
  setAutoSaveEnabled: (autoSaveEnabled) => set({ autoSaveEnabled }),
  scrollTarget: null,
  setScrollTarget: (scrollTarget) => set({ scrollTarget }),
  inspectorTab: "outline",
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  requestedAction: null,
  requestAction: (requestedAction) => set({ requestedAction }),
  clearRequestedAction: () => set({ requestedAction: null }),
  validateRunId: 0,
  reviewRunId: 0,
  requestValidate: () =>
    set((s) => ({ validateRunId: s.validateRunId + 1 })),
  requestReview: () => set((s) => ({ reviewRunId: s.reviewRunId + 1, inspectorTab: "review" })),
  versionsSectionId: null,
  setVersionsSectionId: (versionsSectionId) => set({ versionsSectionId }),
  saveStates: {},
  reportSaveState: (sectionId, state, savedAt) =>
    set((s) => ({ saveStates: { ...s.saveStates, [sectionId]: { state, savedAt } } })),
  resetSaveStates: () => set({ saveStates: {} }),
  activeEditor: null,
  activeSectionId: null,
  activeSectionTitle: null,
  setActiveEditor: (activeEditor, sectionId, sectionTitle) =>
    set({
      activeEditor,
      activeSectionId: sectionId ?? null,
      activeSectionTitle: sectionTitle ?? null,
    }),
  clearSectionContext: () =>
    set({ activeEditor: null, activeSectionId: null, activeSectionTitle: null }),
  validations: {},
  setValidation: (documentId, report) =>
    set((s) => ({ validations: { ...s.validations, [documentId]: report } })),
  reviews: {},
  setReview: (documentId, report) =>
    set((s) => ({ reviews: { ...s.reviews, [documentId]: report } })),
}));
