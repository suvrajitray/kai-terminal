import { useState, useCallback } from "react";
import { fetchPositions, fetchZerodhaPositions } from "@/services/trading-api";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useBrokerStore } from "@/stores/broker-store";
import type { Position } from "@/types";

export function usePositionsRestFallback() {
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (exchanges?: string[]) => {
    setLoading(true);
    try {
      const { getCredentials } = useBrokerStore.getState();
      const upstoxToken = getCredentials("upstox")?.accessToken;
      const zerodhaToken = getCredentials("zerodha")?.accessToken;
      const hasUpstox = !!upstoxToken && !isBrokerTokenExpired("upstox", upstoxToken);
      const hasZerodha = !!zerodhaToken && !isBrokerTokenExpired("zerodha", zerodhaToken);
      const [upstox, zerodha] = await Promise.all([
        hasUpstox  ? fetchPositions(exchanges)        : Promise.resolve([] as Position[]),
        hasZerodha ? fetchZerodhaPositions(exchanges) : Promise.resolve([] as Position[]),
      ]);
      return [...upstox, ...zerodha];
    } finally {
      setLoading(false);
    }
  }, []);

  return { load, loading, setLoading };
}
