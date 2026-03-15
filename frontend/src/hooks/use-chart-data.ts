import { useState, useEffect, useCallback } from "react";
import { fetchCandles, type Candle, type CandleInterval } from "@/services/charts-api";

export function useChartData(instrumentKey: string | null, interval: CandleInterval) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (showLoading: boolean) => {
      if (!instrumentKey) return;
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const data = await fetchCandles(instrumentKey, interval);
        setCandles(data);
      } catch (e) {
        if (showLoading) setError((e as Error).message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [instrumentKey, interval]
  );

  // Full reload on instrument / interval change
  useEffect(() => {
    setCandles([]);
    fetchData(true);
  }, [fetchData]);

  // Silent 5s polling for live price updates
  useEffect(() => {
    if (!instrumentKey) return;
    const id = setInterval(() => fetchData(false), 5000);
    return () => clearInterval(id);
  }, [fetchData, instrumentKey]);

  return { candles, loading, error };
}
