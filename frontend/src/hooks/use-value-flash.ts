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
    setFlash(direction);
    const id = setTimeout(() => setFlash(null), durationMs);
    return () => clearTimeout(id);
  }, [value, durationMs]);

  return flash;
}
