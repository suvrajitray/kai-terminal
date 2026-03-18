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

    const anyBrokerConnected = hasUpstox || hasZerodha;
    if (anyBrokerConnected && UNDERLYINGS.every((u) => getContracts(u).length === 0)) {
      fetchMasterContracts()
        .then((d) => setIndexContracts(d))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
