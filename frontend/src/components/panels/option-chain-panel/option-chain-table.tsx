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
  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr className="h-9 border-b border-border bg-muted/30 text-[10px] text-muted-foreground">
          <th className="py-1.5 text-center font-medium text-muted-foreground/50">Δ</th>
          <th className="py-1.5 text-center font-medium text-red-400/80 tracking-wider">CALL</th>
          <th className="py-1.5 text-center font-medium text-muted-foreground">Strike</th>
          <th className="py-1.5 text-center font-medium text-green-400/80 tracking-wider">PUT</th>
          <th className="py-1.5 text-center font-medium text-muted-foreground/50">Δ</th>
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
            onOrder={onOrder}
          />
        ))}
      </tbody>
    </table>
  );
}
