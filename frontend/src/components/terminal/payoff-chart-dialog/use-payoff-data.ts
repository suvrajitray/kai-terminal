import { useMemo } from "react";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { useIndicesFeed } from "@/hooks/use-indices-feed";
import type { Position } from "@/types";

export interface Leg {
  strike: number;
  instrumentType: "CE" | "PE";
  avgPrice: number;
  quantity: number;
  index: string;
  expiry: string;
}

export interface ExpiryGroup {
  expiry: string;
  legs: Leg[];
}

export const INDEX_TO_FEED: Record<string, keyof ReturnType<typeof useIndicesFeed>> = {
  NIFTY:     "nifty",
  BANKNIFTY: "bankNifty",
  SENSEX:    "sensex",
  FINNIFTY:  "finNifty",
  BANKEX:    "bankex",
};

export function payoffAt(legs: Leg[], spot: number): number {
  return legs.reduce((sum, leg) => {
    const intrinsic =
      leg.instrumentType === "CE"
        ? Math.max(0, spot - leg.strike)
        : Math.max(0, leg.strike - spot);
    return sum + leg.quantity * (intrinsic - leg.avgPrice);
  }, 0);
}

export function usePayoffData(positions: Position[], open: boolean) {
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);
  const feed = useIndicesFeed();

  const { groups, indexName } = useMemo(() => {
    if (!open) return { groups: [], indexName: "" };
    const allLegs: Leg[] = [];
    const indexCount: Record<string, number> = {};

    for (const p of positions.filter((x) => x.quantity !== 0)) {
      const lookup = getByInstrumentKey(p.instrumentToken, p.tradingSymbol);
      if (!lookup) continue;
      const { contract, index } = lookup;
      allLegs.push({
        strike: contract.strikePrice,
        instrumentType: contract.instrumentType,
        avgPrice: p.averagePrice,
        quantity: p.quantity,
        index,
        expiry: contract.expiry,
      });
      indexCount[index] = (indexCount[index] ?? 0) + Math.abs(p.quantity);
    }

    const primaryIndex =
      Object.entries(indexCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

    // Group by expiry, sorted nearest first
    const byExpiry = new Map<string, Leg[]>();
    for (const leg of allLegs) {
      const list = byExpiry.get(leg.expiry) ?? [];
      list.push(leg);
      byExpiry.set(leg.expiry, list);
    }
    const groups: ExpiryGroup[] = [...byExpiry.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([expiry, legs]) => ({ expiry, legs }));

    return { groups, indexName: primaryIndex };
  }, [positions, getByInstrumentKey, open]);

  // Spot price for the primary index — live, not memoized
  const feedKey = open ? INDEX_TO_FEED[indexName] : undefined;
  const spot = feedKey ? (feed[feedKey].ltp ?? 0) : 0;

  return { groups, indexName, spot };
}
