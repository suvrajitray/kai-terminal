import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { BROKERS } from "@/lib/constants";
import { useBrokerStore } from "@/stores/broker-store";
import { useProfitProtectionStore, defaults as ppDefaults } from "@/stores/profit-protection-store";
import { useRiskStateStore } from "@/stores/risk-state-store";
import { useRiskConfig } from "@/hooks/use-risk-config";
import type { PpBrokerEntry } from "@/components/terminal/stats-bar/types";

/**
 * Aggregates per-broker profit-protection status for every known broker.
 * Loads risk config for each broker on mount and derives the active PP entries
 * from a single subscription to each underlying store.
 */
export function useBrokerPpStatus(): PpBrokerEntry[] {
  // Load risk config for every broker. BROKERS is a module-level constant, so
  // the hook call count is stable across renders.
  for (const b of BROKERS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRiskConfig(b.id);
  }

  const ppConfigs   = useProfitProtectionStore((s) => s.configs);
  const credentials = useBrokerStore((s) => s.credentials);
  const riskStates  = useRiskStateStore(useShallow((s) => s.byBroker));

  return useMemo(() => {
    const out: PpBrokerEntry[] = [];
    for (const b of BROKERS) {
      const cfg = ppConfigs[b.id] ?? ppDefaults;
      const isAuth = !!credentials[b.id]?.accessToken;
      if (!cfg.enabled || !isAuth) continue;
      const rs = riskStates[b.id];
      const currentSl = rs?.tslActive && rs.tslFloor !== null ? rs.tslFloor : cfg.mtmSl;
      out.push({ broker: b.id, target: cfg.mtmTarget, currentSl, trailing: cfg.trailingEnabled });
    }
    return out;
  }, [ppConfigs, credentials, riskStates]);
}
