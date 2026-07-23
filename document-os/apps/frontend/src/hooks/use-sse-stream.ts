import type { Section, StreamEvent } from "@documentos/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { aiApi, ApiClientError } from "@/lib/api-client";

export interface StreamState {
  streaming: boolean;
  tokens: string;
  error: string | null;
}

/**
 * Consumes POST /sections/{id}/generate/stream (SSE) with an AbortController.
 * Parses `data: {...}` lines into StreamEvents.
 */
export function useSectionStream() {
  const [state, setState] = useState<StreamState>({ streaming: false, tokens: "", error: null });
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, streaming: false }));
  }, []);

  const start = useCallback(
    async (
      sectionId: string,
      instructions: string | undefined,
      handlers: { onDone: (section: Section) => void; onError?: (message: string) => void },
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ streaming: true, tokens: "", error: null });

      try {
        const res = await aiApi.streamSection(sectionId, instructions, controller.signal);
        if (!res.body) throw new ApiClientError(0, "stream_error", "Stream unavailable");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleEvent = (raw: string): boolean => {
          let event: StreamEvent;
          try {
            event = JSON.parse(raw) as StreamEvent;
          } catch {
            return false;
          }
          if (event.type === "token") {
            setState((s) => ({ ...s, tokens: s.tokens + event.value }));
          } else if (event.type === "done") {
            setState((s) => ({ ...s, streaming: false }));
            handlers.onDone(event.section);
            return true;
          } else if (event.type === "error") {
            setState((s) => ({ ...s, streaming: false, error: event.message }));
            handlers.onError?.(event.message);
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
            if (handleEvent(trimmed.slice(5).trim())) return;
          }
        }
        // Stream ended without a done event — flush remaining buffer, then finish.
        const tail = buffer.trim();
        if (tail.startsWith("data:")) handleEvent(tail.slice(5).trim());
        setState((s) => ({ ...s, streaming: false }));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setState((s) => ({ ...s, streaming: false }));
          return;
        }
        const message = err instanceof ApiClientError ? err.message : "Generation stream failed";
        setState((s) => ({ ...s, streaming: false, error: message }));
        handlers.onError?.(message);
      }
    },
    [],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  return { ...state, start, abort };
}
