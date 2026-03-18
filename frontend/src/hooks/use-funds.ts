import { useState, useEffect, useCallback } from "react";
import { fetchFunds, fetchZerodhaFunds, type FundsData } from "@/services/trading-api";
import { useBrokerStore } from "@/stores/broker-store";

export interface MultiBrokerFunds {
  upstox: FundsData | null;
  zerodha: FundsData | null;
}

export function useFunds() {
  const [funds, setFunds]     = useState<FundsData | null>(null);
  const [allFunds, setAllFunds] = useState<MultiBrokerFunds>({ upstox: null, zerodha: null });
  const [loading, setLoading] = useState(false);

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
              .catch(() => { /* broker may not be authenticated */ })
          : Promise.resolve(),

        isZerodhaAuthenticated
          ? (() => {
              const creds = getCredentials("zerodha");
              if (!creds?.apiKey || !creds?.accessToken) return Promise.resolve();
              return fetchZerodhaFunds(creds.apiKey, creds.accessToken)
                .then((f) => { results.zerodha = f; })
                .catch(() => { /* silently ignore */ });
            })()
          : Promise.resolve(),
      ]);

      setAllFunds(results);
      // Keep single-broker `funds` for backwards compatibility
      setFunds(results.upstox ?? results.zerodha);
    } finally {
      setLoading(false);
    }
  }, [isUpstoxAuthenticated, isZerodhaAuthenticated, getCredentials]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { funds, allFunds, loading, refresh };
}
