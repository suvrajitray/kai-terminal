import type { OptionChainEntry } from "@/types";
import { OptionChainRow } from "./option-chain-row";
import type { OrderIntent } from "./option-chain-order-dialog";

interface Props {
  rows: OptionChainEntry[];
  atmStrike: number;
  spotPrice: number;
  underlying: string;
  liveStrikeSet: Set<number>;
  onOrder: (intent: OrderIntent) => void;
}

export function OptionChainTable({ rows, atmStrike, spotPrice, underlying, liveStrikeSet, onOrder }: Props) {
  const maxOi = rows.reduce((max, row) => Math.max(
    max,
    row.callOptions?.marketData?.oi ?? 0,
    row.putOptions?.marketData?.oi  ?? 0,
  ), 0);

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
          />
        ))}
      </tbody>
    </table>
  );
}
