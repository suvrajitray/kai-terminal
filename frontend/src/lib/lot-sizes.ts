/**
 * Lot sizes by underlying name prefix (case-insensitive).
 * Order matters: more specific entries (BANKNIFTY) must come before shorter prefixes (NIFTY).
 */
const LOT_SIZES: [prefix: string, size: number][] = [
  ["BANKNIFTY", 30],
  ["NIFTY",     65],
  ["SENSEX",    20],
];

/**
 * Returns the lot size for a given F&O trading symbol.
 * Falls back to 1 (i.e. qty mode = lot mode) for unrecognised symbols.
 */
export function getLotSize(tradingSymbol: string): number {
  const upper = tradingSymbol.toUpperCase();
  for (const [prefix, size] of LOT_SIZES) {
    if (upper.startsWith(prefix)) return size;
  }
  return 1;
}
