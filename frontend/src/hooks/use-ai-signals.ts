import { useEffect, useRef, useState } from "react";
import { fetchAiSentiment, type AiSentimentResponse } from "@/services/ai-signals-api";

const REFRESH_INTERVAL_SECONDS = 900; // 15 minutes

interface UseAiSignalsResult {
  data: AiSentimentResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  secondsUntilRefresh: number;
  refresh: () => void;
}

export function useAiSignals(): UseAiSignalsResult {
  const [data, setData]               = useState<AiSentimentResponse | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_INTERVAL_SECONDS);

  const refreshTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchRef = useRef<() => void>(() => {});

  const resetCountdown = () => {
    setSecondsUntilRefresh(REFRESH_INTERVAL_SECONDS);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setSecondsUntilRefresh((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
  };

  const doFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAiSentiment();
      setData(result);
      setLastUpdated(new Date());
      resetCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch AI signals");
    } finally {
      setLoading(false);
    }
  };

  fetchRef.current = doFetch;

  useEffect(() => {
    fetchRef.current();

    refreshTimerRef.current = setInterval(() => {
      fetchRef.current();
    }, REFRESH_INTERVAL_SECONDS * 1000);

    return () => {
      if (refreshTimerRef.current)  clearInterval(refreshTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  return {
    data,
    loading,
    error,
    lastUpdated,
    secondsUntilRefresh,
    refresh: doFetch,
  };
}
