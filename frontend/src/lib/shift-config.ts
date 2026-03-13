import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";

/** Maps underlying symbol name → Upstox instrument key */
export const UNDERLYING_KEYS: Record<string, string> = {
  NIFTY: "NSE_INDEX|Nifty 50",
  BANKNIFTY: "NSE_INDEX|Nifty Bank",
  MIDCPNIFTY: "NSE_INDEX|NIFTY MID SELECT",
  FINNIFTY: "NSE_INDEX|Nifty Fin Service",
  SENSEX: "BSE_INDEX|SENSEX",
  BANKEX: "BSE_INDEX|BANKEX",
};

export function getShiftOffset(underlying: string): number {
  const s = useUserTradingSettingsStore.getState();
  const key = underlying.toUpperCase();
  const map: Record<string, number> = {
    NIFTY: s.niftyShiftOffset,
    BANKNIFTY: s.bankniftyShiftOffset,
    MIDCPNIFTY: s.midcpniftyShiftOffset,
    FINNIFTY: s.finniftyShiftOffset,
    SENSEX: s.sensexShiftOffset,
    BANKEX: s.bankexShiftOffset,
  };
  return map[key] ?? 10;
}

export function getUnderlyingKey(underlying: string): string | null {
  return UNDERLYING_KEYS[underlying.toUpperCase()] ?? null;
}
