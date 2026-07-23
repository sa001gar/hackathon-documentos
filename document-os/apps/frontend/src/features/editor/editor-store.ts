import type { ReviewReport, ValidationReport } from "@documentos/shared-types";
import { create } from "zustand";
import type { SaveState } from "@/hooks/use-autosave";

export type InspectorTab = "outline" | "validate" | "review" | "activity";
export type EditorAction = "export";

interface SectionSaveInfo {
  state: SaveState;
  savedAt: number | null;
}

/**
 * Per-document editor UI state shared between the center canvas (editor page)
 * and the right inspector / slide-over panels (which live in the app shell).
 */
interface EditorUiState {
  jobId: string | null;
  setJobId: (id: string | null) => void;
  generateOpen: boolean;
  setGenerateOpen: (open: boolean) => void;
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
  validations: Record<string, ValidationReport>;
  setValidation: (documentId: string, report: ValidationReport) => void;
  reviews: Record<string, ReviewReport>;
  setReview: (documentId: string, report: ReviewReport) => void;
}

export const useEditorStore = create<EditorUiState>()((set) => ({
  jobId: null,
  setJobId: (jobId) => set({ jobId }),
  generateOpen: false,
  setGenerateOpen: (generateOpen) => set({ generateOpen }),
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
    set((s) => ({ validateRunId: s.validateRunId + 1, inspectorTab: "validate" })),
  requestReview: () => set((s) => ({ reviewRunId: s.reviewRunId + 1, inspectorTab: "review" })),
  versionsSectionId: null,
  setVersionsSectionId: (versionsSectionId) => set({ versionsSectionId }),
  saveStates: {},
  reportSaveState: (sectionId, state, savedAt) =>
    set((s) => ({ saveStates: { ...s.saveStates, [sectionId]: { state, savedAt } } })),
  resetSaveStates: () => set({ saveStates: {} }),
  validations: {},
  setValidation: (documentId, report) =>
    set((s) => ({ validations: { ...s.validations, [documentId]: report } })),
  reviews: {},
  setReview: (documentId, report) =>
    set((s) => ({ reviews: { ...s.reviews, [documentId]: report } })),
}));
