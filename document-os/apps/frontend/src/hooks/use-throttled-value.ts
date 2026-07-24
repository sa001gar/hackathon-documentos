import { useEffect, useRef, useState } from "react";

/**
 * Returns the latest `value` but only updates at most once every `delay` ms.
 * Leading edge fires immediately; trailing edge delivers the latest value
 * after a quiet period.
 *
 * Useful for throttling expensive computations on rapidly-changing inputs
 * (e.g. `markdownToHtmlFast` called 60×/s by the typewriter hook).
 */
export function useThrottledValue<T>(value: T, delay: number): T {
  const [throttled, setThrottled] = useState(value);
  const lastRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const now = Date.now();
    if (now - lastRef.current >= delay) {
      lastRef.current = now;
      setThrottled(value);
    } else {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lastRef.current = Date.now();
        setThrottled(value);
      }, delay - (now - lastRef.current));
    }
    return () => clearTimeout(timerRef.current);
  }, [value, delay]);

  return throttled;
}
