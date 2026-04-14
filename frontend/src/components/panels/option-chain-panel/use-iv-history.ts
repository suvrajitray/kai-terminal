import { useState, useEffect, useRef } from "react";
import { fetchIvHistory } from "@/services/trading-api";
import type { IvSnapshot } from "@/types";

export function useIvHistory(underlying: string) {
  const [ivHistory, setIvHistory] = useState<IvSnapshot[]>([]);
  const cache = useRef<Record<string, IvSnapshot[]>>({});

  useEffect(() => {
    if (!underlying) return;
    const cached = cache.current[underlying];
    if (cached) { setIvHistory(cached); return; }
    fetchIvHistory(underlying)
      .then((data) => {
        cache.current[underlying] = data;
        setIvHistory(data);
      })
      .catch(() => {});
  }, [underlying]);

  return ivHistory;
}
