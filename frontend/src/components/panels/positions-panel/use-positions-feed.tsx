import { useState, useCallback } from "react";
import { usePositionsRestFallback } from "./use-positions-rest-fallback";
import { useSignalrPositions } from "./use-signalr-positions";
import type { Position } from "@/types";

export function usePositionsFeed(onOrderUpdate?: () => void) {
  const [positions, setPositions] = useState<Position[]>([]);
  const { load: restLoad, loading, setLoading } = usePositionsRestFallback();

  const load = useCallback(async (exchanges?: string[]) => {
    const result = await restLoad(exchanges);
    setPositions(result ?? []);
  }, [restLoad]);

  const handlePositions = useCallback((incoming: Position[]) => {
    setPositions((prev) => {
      if (prev.length === 0) return incoming;
      // Preserve live LTP (and derived PnL) for positions we already track —
      // the REST poll returns stale LTP which would clobber the live feed.
      const liveMap = new Map(prev.map((p) => [p.instrumentToken, p]));
      return incoming.map((p) => {
        const live = liveMap.get(p.instrumentToken);
        if (!live) return p;
        const ltp = live.ltp;
        const pnl = p.pnl + p.quantity * (ltp - p.ltp);
        return { ...p, ltp, pnl };
      });
    });
  }, []);

  const handleLtpBatch = useCallback((updates: Array<{ instrumentToken: string; ltp: number }>) => {
    setPositions((prev) => {
      if (prev.length === 0) return prev;
      const map = new Map(updates.map((u) => [u.instrumentToken, u.ltp]));
      return prev.map((p) => {
        const ltp = map.get(p.instrumentToken);
        if (ltp === undefined) return p;
        const pnl = p.pnl + p.quantity * (ltp - p.ltp);
        return { ...p, ltp, pnl };
      });
    });
  }, []);

  const { isLive } = useSignalrPositions({
    onPositions: handlePositions,
    onLtpBatch: handleLtpBatch,
    onOrderUpdate,
    onFallbackLoad: load,
    setLoading,
  });

  return { positions, setPositions, loading, isLive, load };
}
