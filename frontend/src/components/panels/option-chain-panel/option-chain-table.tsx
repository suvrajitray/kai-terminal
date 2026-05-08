import { memo, useMemo } from "react";
import type { OptionChainEntry } from "@/types";
import { OptionChainRow } from "./option-chain-row";
import type { OrderIntent } from "@/components/panels/order-dialog";
import { usePositionsStore } from "@/stores/positions-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";

interface Props {
  rows: OptionChainEntry[];
  atmStrike: number;
  spotPrice: number;
  underlying: string;
  liveStrikeSet: Set<number>;
  onOrder: (intent: OrderIntent) => void;
}

export const OptionChainTable = memo(function OptionChainTable({ rows, atmStrike, spotPrice, underlying, liveStrikeSet, onOrder }: Props) {
  const positions        = usePositionsStore((s) => s.positions);
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);

  const maxOi = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.callOptions?.marketData?.oi ?? 0, row.putOptions?.marketData?.oi ?? 0), 0),
    [rows],
  );

  // Build a Set of upstoxTokens (= OptionSide.instrumentKey format) for open positions.
  // Upstox: instrumentToken is already in NSE_FO|... format — matches directly.
  // Zerodha: instrumentToken is the trading symbol — resolve to upstoxToken via contracts store.
  const openPositionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of positions) {
      if (p.quantity === 0) continue;
      const lookup = getByInstrumentKey(p.instrumentToken, p.tradingSymbol);
      keys.add(lookup ? lookup.contract.upstoxToken : p.instrumentToken);
    }
    return keys;
  }, [positions, getByInstrumentKey]);

  return (
    <table className="w-full border-collapse text-[10px]">
      <thead className="sticky top-0 z-10 bg-muted/20 backdrop-blur-sm">
        <tr className="h-9 border-b border-border text-muted-foreground">
          <th className="w-[14%] py-1.5 text-center font-medium text-muted-foreground/50" title="Open Interest · OI Change">OI</th>
          <th className="w-[13%] py-1.5 text-center font-medium text-muted-foreground/50">Δ</th>
          <th className="w-[14%] py-1.5 text-center font-medium text-rose-400/80 tracking-wider">CALL</th>
          <th className="w-[18%] py-1.5 text-center font-medium text-muted-foreground">Strike</th>
          <th className="w-[14%] py-1.5 text-center font-medium text-emerald-400/80 tracking-wider">PUT</th>
          <th className="w-[13%] py-1.5 text-center font-medium text-muted-foreground/50">Δ</th>
          <th className="w-[14%] py-1.5 text-center font-medium text-muted-foreground/50" title="Open Interest · OI Change">OI</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((entry) => (
          <OptionChainRow
            key={entry.strikePrice}
            entry={entry}
            isAtm={entry.strikePrice === atmStrike}
            isLive={liveStrikeSet.has(entry.strikePrice)}
            spotPrice={spotPrice}
            underlying={underlying}
            maxOi={maxOi}
            onOrder={onOrder}
            hasCallPos={!!entry.callOptions?.instrumentKey && openPositionKeys.has(entry.callOptions.instrumentKey)}
            hasPutPos={!!entry.putOptions?.instrumentKey && openPositionKeys.has(entry.putOptions.instrumentKey)}
          />
        ))}
      </tbody>
    </table>
  );
});
