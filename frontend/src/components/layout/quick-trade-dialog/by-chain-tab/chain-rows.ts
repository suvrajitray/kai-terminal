import type { OptionChainEntry } from "@/types";
import type { ChainRow, StrategyMode } from "./types";

export function buildChainRows(
  chain: OptionChainEntry[],
  spotPrice: number,
  mode: StrategyMode,
): { rows: ChainRow[]; atmStrike: number | null } {
  if (!chain.length) return { rows: [], atmStrike: null };

  const sorted = [...chain].sort((a, b) => a.strikePrice - b.strikePrice);
  const atmEntry = sorted.reduce((best, entry) =>
    Math.abs(entry.strikePrice - spotPrice) < Math.abs(best.strikePrice - spotPrice) ? entry : best,
  );
  const atmStrike = atmEntry.strikePrice;
  const atmIndex = sorted.findIndex((entry) => entry.strikePrice === atmStrike);

  if (mode === "straddle") {
    return {
      atmStrike,
      rows: sorted.map((entry) => ({
        diff: entry.strikePrice - atmStrike,
        ceStrike: entry.strikePrice,
        ceLtp: entry.callOptions?.marketData?.ltp,
        ceKey: entry.callOptions?.instrumentKey,
        peStrike: entry.strikePrice,
        peLtp: entry.putOptions?.marketData?.ltp,
        peKey: entry.putOptions?.instrumentKey,
      })),
    };
  }

  const maxPairs = Math.min(atmIndex, sorted.length - atmIndex - 1);
  const rows: ChainRow[] = [];

  for (let index = 1; index <= maxPairs; index++) {
    const ceEntry = sorted[atmIndex + index];
    const peEntry = sorted[atmIndex - index];

    rows.push({
      diff: ceEntry.strikePrice - atmStrike,
      ceStrike: ceEntry.strikePrice,
      ceLtp: ceEntry.callOptions?.marketData?.ltp,
      ceKey: ceEntry.callOptions?.instrumentKey,
      peStrike: peEntry.strikePrice,
      peLtp: peEntry.putOptions?.marketData?.ltp,
      peKey: peEntry.putOptions?.instrumentKey,
    });
  }

  return { rows, atmStrike };
}

export function formatPrice(value?: number) {
  return value != null ? value.toFixed(2) : "—";
}

