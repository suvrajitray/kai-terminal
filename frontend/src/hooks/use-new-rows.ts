import { useEffect, useRef, useState } from "react";

/**
 * Returns a Set of keys that are NEW in the current render cycle.
 * Skips the initial render so the first load doesn't animate everything.
 * Clears new-key status after `durationMs`.
 */
export function useNewRows<T>(
  items: T[],
  getKey: (item: T) => string,
  durationMs = 350,
): Set<string> {
  const seenRef = useRef<Set<string> | null>(null);
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentKeys = new Set(items.map(getKey));

    // First render — seed the seen set without animating
    if (seenRef.current === null) {
      seenRef.current = currentKeys;
      return;
    }

    const fresh = new Set<string>();
    for (const key of currentKeys) {
      if (!seenRef.current.has(key)) fresh.add(key);
    }
    seenRef.current = currentKeys;

    if (fresh.size === 0) return;

    const showId = setTimeout(() => setNewKeys(fresh), 0);
    const clearId = setTimeout(() => setNewKeys(new Set()), durationMs);
    return () => {
      clearTimeout(showId);
      clearTimeout(clearId);
    };
  }, [items, getKey, durationMs]);

  return newKeys;
}
