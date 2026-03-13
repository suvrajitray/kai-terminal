import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";

/** Maps underlying symbol name → Upstox instrument key */
export const UNDERLYING_KEYS: Record<string, string> = {
  NIFTY: "NSE_INDEX|Nifty 50",
  SENSEX: "BSE_INDEX|SENSEX",
  BANKNIFTY: "NSE_INDEX|Nifty Bank",
};

export function getShiftOffset(underlying: string): number {
  const s = useUserTradingSettingsStore.getState();
  const key = underlying.toUpperCase();
  const map: Record<string, number> = {
    NIFTY: s.niftyShiftOffset,
    SENSEX: s.sensexShiftOffset,
    BANKNIFTY: s.bankniftyShiftOffset,
  };
  return map[key] ?? 10;
}
