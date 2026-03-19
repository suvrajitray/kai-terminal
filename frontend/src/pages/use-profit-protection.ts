import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useRiskStateStore } from "@/stores/risk-state-store";

/**
 * Returns the live SL value for display in the stats bar.
 * - When the backend risk engine has activated TSL, shows the current floor from the risk engine.
 * - Otherwise falls back to the configured hard SL from PP config.
 * Exit orders are always fired by the backend Worker — this hook is display-only.
 */
export function useProfitProtection(brokerType: string = "upstox") {
  const pp       = useProfitProtectionStore((s) => s.getConfig(brokerType));
  const { tslActive, tslFloor } = useRiskStateStore((s) => s.get(brokerType));

  const currentSl = tslActive && tslFloor !== null ? tslFloor : pp.mtmSl;

  return { currentSl };
}
