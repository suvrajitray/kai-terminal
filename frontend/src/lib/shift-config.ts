/**
 * Configurable price offsets for Shift Up / Shift Down per underlying.
 * Shift Up  → targetPremium = LTP + offset  (GreaterThan search)
 * Shift Down → targetPremium = LTP - offset  (LessThan search)
 */
export const SHIFT_OFFSETS: Record<string, number> = {
  NIFTY: 5,
  BANKNIFTY: 10,
  MIDCPNIFTY: 10,
  FINNIFTY: 10,
  SENSEX: 10,
  BANKEX: 10,
};

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
  return SHIFT_OFFSETS[underlying.toUpperCase()] ?? 10;
}

export function getUnderlyingKey(underlying: string): string | null {
  return UNDERLYING_KEYS[underlying.toUpperCase()] ?? null;
}
