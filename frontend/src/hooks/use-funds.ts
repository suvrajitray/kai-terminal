import { useState, useEffect, useCallback } from "react";
import { fetchFunds, fetchZerodhaFunds, type FundsData } from "@/services/trading-api";
import { useBrokerStore } from "@/stores/broker-store";

export interface MultiBrokerFunds {
  upstox: FundsData | null;
  zerodha: FundsData | null;
}

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useFunds(pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const [funds, setFunds]       = useState<FundsData | null>(null);
  const [allFunds, setAllFunds] = useState<MultiBrokerFunds>({ upstox: null, zerodha: null });
  const [loading, setLoading]   = useState(false);

  const isUpstoxAuthenticated  = useBrokerStore((s) => s.isAuthenticated("upstox"));
  const isZerodhaAuthenticated = useBrokerStore((s) => s.isAuthenticated("zerodha"));
  const getCredentials         = useBrokerStore((s) => s.getCredentials);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results: MultiBrokerFunds = { upstox: null, zerodha: null };

      await Promise.all([
        isUpstoxAuthenticated
          ? fetchFunds()
              .then((f) => { results.upstox = f; })
              .catch(() => {})
          : Promise.resolve(),

        isZerodhaAuthenticated
          ? (() => {
              const creds = getCredentials("zerodha");
              if (!creds?.apiKey || !creds?.accessToken) return Promise.resolve();
              return fetchZerodhaFunds(creds.apiKey, creds.accessToken)
                .then((f) => { results.zerodha = f; })
                .catch(() => {});
            })()
          : Promise.resolve(),
      ]);

      setAllFunds(results);
      setFunds(results.upstox ?? results.zerodha);
    } finally {
      setLoading(false);
    }
  }, [isUpstoxAuthenticated, isZerodhaAuthenticated, getCredentials]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(id);
  }, [refresh, pollIntervalMs]);

  return { funds, allFunds, loading, refresh };
}
