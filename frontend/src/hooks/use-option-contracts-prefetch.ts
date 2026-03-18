import { useEffect, useRef } from "react";
import { useBrokerStore } from "@/stores/broker-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { fetchMasterContracts } from "@/services/trading-api";
import { UNDERLYING_KEYS } from "@/lib/shift-config";

const UNDERLYINGS = Object.keys(UNDERLYING_KEYS);

/**
 * Fetches option contracts for all authenticated brokers if the in-memory store is empty.
 * Runs once on mount — handles the page-refresh case where the non-persisted store is cleared.
 */
export function useOptionContractsPrefetch() {
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const { getCredentials } = useBrokerStore.getState();
    const { getContracts, setIndexContracts } = useOptionContractsStore.getState();

    const hasUpstox = (() => {
      const token = getCredentials("upstox")?.accessToken;
      return !!token && !isBrokerTokenExpired("upstox", token);
    })();

    const hasZerodha = (() => {
      const token = getCredentials("zerodha")?.accessToken;
      return !!token && !isBrokerTokenExpired("zerodha", token);
    })();

    if (hasUpstox && UNDERLYINGS.every((u) => getContracts(`upstox:${u}`).length === 0)) {
      fetchMasterContracts("upstox")
        .then((d) => setIndexContracts("upstox", d))
        .catch(() => {});
    }

    if (hasZerodha && UNDERLYINGS.every((u) => getContracts(`zerodha:${u}`).length === 0)) {
      fetchMasterContracts("zerodha")
        .then((d) => setIndexContracts("zerodha", d))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
