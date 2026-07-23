import { useEffect, useMemo, useRef, useState } from "react";

/** Debounced value — updates `delay` ms after the last change. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Debounced callback — stable identity, always invokes the latest fn. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, waitMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const debounced = useMemo(
    () =>
      Object.assign(
        (...args: A) => {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => fnRef.current(...args), waitMs);
        },
        {
          cancel: () => clearTimeout(timerRef.current),
          flush: (...args: A) => {
            clearTimeout(timerRef.current);
            fnRef.current(...args);
          },
        },
      ),
    [waitMs],
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);
  return debounced;
}
