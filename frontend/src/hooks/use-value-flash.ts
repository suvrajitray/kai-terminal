import { useEffect, useRef, useState } from "react";

type FlashDirection = "up" | "down" | null;

/** Returns "up" or "down" briefly when `value` changes, then resets to null. */
export function useValueFlash(value: number, durationMs = 600): FlashDirection {
  const [flash, setFlash] = useState<FlashDirection>(null);
  const prevRef = useRef<number>(value);

  useEffect(() => {
    if (value === prevRef.current) return;
    const direction: FlashDirection = value > prevRef.current ? "up" : "down";
    prevRef.current = value;
    const showId = setTimeout(() => setFlash(direction), 0);
    const clearId = setTimeout(() => setFlash(null), durationMs);
    return () => {
      clearTimeout(showId);
      clearTimeout(clearId);
    };
  }, [value, durationMs]);

  return flash;
}
