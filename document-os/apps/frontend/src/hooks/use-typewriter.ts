import { useEffect, useRef, useState } from "react";

/**
 * Typewriter reveal for streamed text.
 *
 * Tokens arrive in chunks from SSE; this hook releases them character-by-
 * character on a requestAnimationFrame loop so the text feels like the AI is
 * actively typing. Pacing has a small random jitter plus a catch-up factor:
 * the further behind the display is, the more characters per frame — so it
 * never lags far behind the model, but never dumps chunks either.
 *
 * If the target string shrinks or diverges (a new stream/section started),
 * the display snaps immediately instead of animating backwards.
 */
export function useTypewriter(target: string): string {
  const [display, setDisplay] = useState("");
  const targetRef = useRef(target);
  targetRef.current = target;
  const displayRef = useRef("");

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = targetRef.current;
      let d = displayRef.current;

      const diverged = d.length > 0 && !t.startsWith(d.slice(0, Math.min(d.length, 64)));
      if (t.length < d.length || diverged) {
        // New stream — snap to the fresh target.
        d = t;
      } else if (d.length < t.length) {
        const lag = t.length - d.length;
        // Base 1–2 chars/frame (~60–120 chars/sec) + catch-up when behind.
        const step = Math.min(lag, 1 + Math.floor(Math.random() * 2) + Math.floor(lag / 30));
        d = t.slice(0, d.length + step);
      }

      if (d !== displayRef.current) {
        displayRef.current = d;
        setDisplay(d);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return display;
}
