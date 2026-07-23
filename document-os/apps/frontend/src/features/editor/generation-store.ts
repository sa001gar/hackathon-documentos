import type { DocGenEvent, DocumentDetail, Section } from "@documentos/shared-types";
import { create } from "zustand";
import { ApiClientError, rawRequest } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";

export type GenPhase =
  | "idle"
  | "connecting"
  | "planning"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled";

export type GenSectionStatus = "queued" | "generating" | "completed" | "failed";

export interface GenSection {
  id: string;
  title: string;
  status: GenSectionStatus;
  tokens: string;
}

export interface ActivityItem {
  id: number;
  at: number;
  kind: "info" | "success" | "error";
  message: string;
}

interface GenerationStore {
  phase: GenPhase;
  documentId: string | null;
  documentTitle: string;
  sections: GenSection[];
  /**
   * id → status map. Only receives a NEW object reference when a status
   * actually changes (never on token updates), so components can select it
   * directly without triggering re-renders per token.
   */
  statusBySection: Record<string, GenSectionStatus>;
  currentSectionId: string | null;
  totalSections: number;
  completedCount: number;
  failedCount: number;
  startedAt: number | null;
  error: string | null;
  activity: ActivityItem[];

  start: (documentId: string, prompt: string, useExisting: boolean) => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const INITIAL = {
  phase: "idle" as GenPhase,
  documentId: null as string | null,
  documentTitle: "",
  sections: [] as GenSection[],
  statusBySection: {} as Record<string, GenSectionStatus>,
  currentSectionId: null as string | null,
  totalSections: 0,
  completedCount: 0,
  failedCount: 0,
  startedAt: null as number | null,
  error: null as string | null,
  activity: [] as ActivityItem[],
};

const ACTIVE: ReadonlySet<GenPhase> = new Set(["connecting", "planning", "generating"]);
const MAX_ACTIVITY = 200;

let abortController: AbortController | null = null;
let activitySeq = 0;

/** Patch one section inside the cached DocumentDetail. */
function patchDocumentSection(documentId: string, section: Section) {
  queryClient.setQueryData<DocumentDetail>(["document", documentId], (old) =>
    old
      ? {
          ...old,
          sections: old.sections.map((s) => (s.id === section.id ? { ...s, ...section } : s)),
        }
      : old,
  );
}

export const useGenerationStore = create<GenerationStore>()((set, get) => {
  const act = (kind: ActivityItem["kind"], message: string) => {
    set((s) => ({
      activity: [...s.activity, { id: ++activitySeq, at: Date.now(), kind, message }].slice(-MAX_ACTIVITY),
    }));
  };

  /** Shared SSE driver used by start() and resume(). */
  const runStream = async (documentId: string, prompt: string, useExisting: boolean) => {
    const controller = new AbortController();
    abortController = controller;
    let aborted = false;
    controller.signal.addEventListener("abort", () => {
      aborted = true;
    });

    const finish = (phase: GenPhase, error: string | null = null) => {
      if (aborted) return;
      set((s) => ({ ...s, phase, error, currentSectionId: null }));
    };

    try {
      const res = await rawRequest(`/documents/${documentId}/generate/stream`, {
        body: { prompt: prompt.trim(), use_existing_structure: useExisting },
        signal: controller.signal,
        method: "POST",
      });
      if (!res.body) throw new ApiClientError(0, "stream_error", "Stream unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      /** Returns true when a terminal event was handled. */
      const handle = (event: DocGenEvent): boolean => {
        if (aborted) return true;
        switch (event.type) {
          case "generation_started":
            break;
          case "planning_started":
            set((s) => ({ ...s, phase: "planning" }));
            act("info", "Planning document outline…");
            break;
          case "outline_created": {
            const sections: GenSection[] = event.sections.map((x) => ({
              id: x.id,
              title: x.title,
              status: x.status === "completed" ? "completed" : "queued",
              tokens: "",
            }));
            const statusBySection: Record<string, GenSectionStatus> = {};
            for (const x of sections) statusBySection[x.id] = x.status;
            const done = sections.filter((x) => x.status === "completed").length;
            set((s) => ({
              ...s,
              phase: "generating",
              documentTitle: event.title,
              sections,
              statusBySection,
              totalSections: event.total,
              completedCount: done,
            }));
            act("success", `Outline ready — ${event.total} section${event.total === 1 ? "" : "s"} to write`);
            // Sections now exist in the DB: pull them into the canvas as placeholders.
            void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
            break;
          }
          case "section_started":
            set((s) => ({
              ...s,
              currentSectionId: event.section_id,
              sections: s.sections.map((x) =>
                x.id === event.section_id ? { ...x, status: "generating", tokens: "" } : x,
              ),
              statusBySection: { ...s.statusBySection, [event.section_id]: "generating" },
            }));
            act("info", `Writing: ${event.title}`);
            break;
          case "token":
            // NB: statusBySection keeps its reference — no status change here.
            set((s) => ({
              sections: s.sections.map((x) =>
                x.id === event.section_id ? { ...x, tokens: x.tokens + event.value } : x,
              ),
            }));
            break;
          case "section_completed":
            set((s) => ({
              completedCount: s.completedCount + 1,
              sections: s.sections.map((x) =>
                x.id === event.section.id ? { ...x, status: "completed" } : x,
              ),
              statusBySection: { ...s.statusBySection, [event.section.id]: "completed" },
            }));
            patchDocumentSection(documentId, event.section);
            act("success", `Completed: ${event.section.title}`);
            break;
          case "section_failed":
            set((s) => ({
              failedCount: s.failedCount + 1,
              sections: s.sections.map((x) =>
                x.id === event.section_id ? { ...x, status: "failed" } : x,
              ),
              statusBySection: { ...s.statusBySection, [event.section_id]: "failed" },
            }));
            patchDocumentSection(documentId, {
              id: event.section_id,
              status: "error",
            } as Section);
            act("error", `Failed: ${event.title} — ${event.message}`);
            break;
          case "generation_completed":
            finish("completed");
            act(
              "success",
              `Generation complete — ${event.succeeded}/${event.total} sections written${
                event.failed ? `, ${event.failed} failed` : ""
              }`,
            );
            void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
            void queryClient.invalidateQueries({ queryKey: ["activity", documentId] });
            void queryClient.invalidateQueries({ queryKey: ["documents"] });
            return true;
          case "error":
            finish("failed", event.message);
            act("error", event.message);
            void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
            return true;
        }
        return false;
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          let event: DocGenEvent;
          try {
            event = JSON.parse(trimmed.slice(5).trim()) as DocGenEvent;
          } catch {
            continue;
          }
          if (handle(event)) return;
        }
      }

      // Stream ended without a terminal event — treat as a dropped connection.
      const s = get();
      if (!aborted && s.phase !== "completed" && s.phase !== "failed") {
        act("error", "Connection lost before generation finished");
        finish("failed", "Connection lost before generation finished");
        void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof ApiClientError ? err.message : "Generation failed";
      act("error", msg);
      finish("failed", msg);
    }
  };

  return {
    ...INITIAL,

    start: async (documentId, prompt, useExisting) => {
      if (ACTIVE.has(get().phase)) return;
      abortController?.abort();
      set({
        ...INITIAL,
        phase: "connecting",
        documentId,
        startedAt: Date.now(),
      });
      act("info", prompt.trim() ? "Starting generation…" : "Resuming generation…");
      await runStream(documentId, prompt, useExisting);
    },

    resume: async () => {
      const { documentId } = get();
      if (!documentId || ACTIVE.has(get().phase)) return;
      abortController?.abort();
      // Keep activity + sections so the user sees continuity; keep the clock running.
      set((s) => ({ ...s, phase: "connecting", error: null, startedAt: s.startedAt ?? Date.now() }));
      act("info", "Resuming generation…");
      await runStream(documentId, "", true);
    },

    cancel: () => {
      abortController?.abort();
      abortController = null;
      const { documentId } = get();
      set((s) => ({ ...s, phase: "cancelled", currentSectionId: null }));
      act("info", "Generation cancelled");
      // Backend resets the in-flight section to pending on disconnect;
      // give it a beat, then refresh the canvas.
      if (documentId) {
        setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
        }, 400);
      }
    },

    reset: () => {
      abortController?.abort();
      abortController = null;
      set({ ...INITIAL });
    },
  };
});
