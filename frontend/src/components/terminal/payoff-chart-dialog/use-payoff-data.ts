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

export interface RenderedCurve {
  expiry: string;
  color: string;
  pts: [number, number][];
  breakevens: number[];
}

export interface DisplayItem {
  instrumentToken: string;
  tradingSymbol: string;
  quantity: number;
  pnl: number;
  broker: string;
  contract?: {
    strikePrice: number;
    instrumentType: "CE" | "PE";
    expiry: string;
  };
}

export interface UnderlyingPayoffGroup {
  underlying: string;
  feedKey: keyof ReturnType<typeof useIndicesFeed> | undefined;
  expiryGroups: ExpiryGroup[];
  items: DisplayItem[];
  totalPnl: number;
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

  const underlyingGroups: UnderlyingPayoffGroup[] = useMemo(() => {
    if (!open) return [];

    // Map underlying → { legs per expiry, display items }
    const underlyingMap = new Map<string, {
      byExpiry: Map<string, Leg[]>;
      items: DisplayItem[];
      feedKey: keyof ReturnType<typeof useIndicesFeed> | undefined;
    }>();

    for (const p of positions) {
      const lookup = getByInstrumentKey(p.instrumentToken, p.tradingSymbol);
      const index = lookup?.index ?? p.tradingSymbol;
      const contract = lookup?.contract;

      if (!underlyingMap.has(index)) {
        underlyingMap.set(index, {
          byExpiry: new Map(),
          items: [],
          feedKey: INDEX_TO_FEED[index],
        });
      }

      const entry = underlyingMap.get(index)!;

      // Display item for left panel
      entry.items.push({
        instrumentToken: p.instrumentToken,
        tradingSymbol: p.tradingSymbol,
        quantity: p.quantity,
        pnl: p.pnl,
        broker: p.broker ?? "upstox",
        contract: contract
          ? { strikePrice: contract.strikePrice, instrumentType: contract.instrumentType, expiry: contract.expiry }
          : undefined,
      });

      // Legs for payoff computation (only open positions with contracts)
      if (contract && p.quantity !== 0) {
        const expiry = contract.expiry;
        const legs = entry.byExpiry.get(expiry) ?? [];
        legs.push({
          strike: contract.strikePrice,
          instrumentType: contract.instrumentType,
          avgPrice: p.averagePrice,
          quantity: p.quantity,
          index,
          expiry,
        });
        entry.byExpiry.set(expiry, legs);
      }
    }

    return [...underlyingMap.entries()].map(([underlying, { byExpiry, items, feedKey }]) => {
      const expiryGroups: ExpiryGroup[] = [...byExpiry.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([expiry, legs]) => ({ expiry, legs }));

      const totalPnl = items.reduce((sum, item) => sum + item.pnl, 0);

      return { underlying, feedKey, expiryGroups, items, totalPnl };
    });
  }, [positions, getByInstrumentKey, open]);

  return { underlyingGroups };
}
