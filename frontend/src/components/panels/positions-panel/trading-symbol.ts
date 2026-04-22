import { INSTRUMENTS } from "@/lib/lot-sizes";
const INDEX_PREFIXES = [...INSTRUMENTS].sort((a, b) => b.length - a.length);

export function parseTradingSymbol(symbol: string) {
  const upper = symbol.toUpperCase();
  const type = upper.endsWith("CE") ? "CE" : upper.endsWith("PE") ? "PE" : null;
  if (!type) return null;

  const withoutType = upper.slice(0, -2);
  const index = INDEX_PREFIXES.find((prefix) => withoutType.startsWith(prefix));
  if (!index) return null;

  const strike = withoutType.match(/(\d+)$/)?.[1];
  if (!strike) return null;

  return { index, strike, type: type as "CE" | "PE" };
}
