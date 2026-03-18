import { useEffect, useRef } from "react";
import { useBrokerStore } from "@/stores/broker-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { fetchOptionContracts, fetchZerodhaOptionContracts } from "@/services/trading-api";
import { UNDERLYING_KEYS } from "@/lib/shift-config";

/**
 * Fetches option contracts for all authenticated brokers if the in-memory store is empty.
 * Runs once on mount — handles the page-refresh case where the non-persisted store is cleared.
 */
export function useOptionContractsPrefetch() {
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const { getCredentials, credentials } = useBrokerStore.getState();
    const { getContracts, setContracts } = useOptionContractsStore.getState();
    const underlyings = Object.keys(UNDERLYING_KEYS);

    // Upstox
    const upstoxToken = getCredentials("upstox")?.accessToken;
    if (upstoxToken && !isBrokerTokenExpired("upstox", upstoxToken)) {
      const missing = underlyings.filter((u) => getContracts(u).length === 0);
      if (missing.length > 0) {
        Promise.all(missing.map((u) => fetchOptionContracts(UNDERLYING_KEYS[u])))
          .then((results) => missing.forEach((u, i) => setContracts(u, results[i])))
          .catch(() => {});
      }
    }

    // Zerodha
    const zerodhaToken = getCredentials("zerodha")?.accessToken;
    if (zerodhaToken && !isBrokerTokenExpired("zerodha", zerodhaToken)) {
      const missing = underlyings.filter((u) => getContracts(`zerodha:${u}`).length === 0);
      if (missing.length > 0) {
        Promise.all(missing.map((u) => fetchZerodhaOptionContracts(u)))
          .then((results) => missing.forEach((u, i) => setContracts(`zerodha:${u}`, results[i])))
          .catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
