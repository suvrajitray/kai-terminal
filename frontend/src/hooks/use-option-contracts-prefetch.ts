import { useEffect, useRef } from "react";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { fetchMasterContracts } from "@/services/trading-api";
import { UNDERLYING_KEYS } from "@/lib/shift-config";

const UNDERLYINGS = Object.keys(UNDERLYING_KEYS);

/**
 * Fetches option contract master data if the in-memory store is empty.
 * Runs once on mount — handles the page-refresh case where the non-persisted store is cleared.
 *
 * Does not require a broker: the backend serves Upstox contracts via the admin
 * analytics token. When broker headers are present (added by the api-client),
 * the backend additionally merges in per-broker contract data.
 */
export function useOptionContractsPrefetch() {
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const { getContracts, setIndexContracts } = useOptionContractsStore.getState();

    if (UNDERLYINGS.every((u) => getContracts(u).length === 0)) {
      fetchMasterContracts()
        .then((d) => setIndexContracts(d))
        .catch(() => {});
    }
  }, []);
}
