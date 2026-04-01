import type { OptionChainEntry } from "@/types";
import { OptionChainRow } from "./option-chain-row";

interface Props {
  rows: OptionChainEntry[];
  atmStrike: number;
  liveStrikeSet: Set<number>;
}

export function OptionChainTable({ rows, atmStrike, liveStrikeSet }: Props) {
  const callOis = rows.map((r) => r.callOptions?.marketData?.oi ?? 0);
  const putOis  = rows.map((r) => r.putOptions?.marketData?.oi  ?? 0);
  const maxCallOi = Math.max(...callOis, 1);
  const maxPutOi  = Math.max(...putOis,  1);

  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr className="border-b border-border bg-muted/30 text-[10px] text-muted-foreground">
          {/* CALL side header */}
          <th colSpan={3} className="py-1 text-center font-medium text-red-400/80 tracking-wider">
            CALL
          </th>
          {/* Strike header */}
          <th className="py-1 text-center font-medium text-muted-foreground">
            Strike
          </th>
          {/* PUT side header */}
          <th colSpan={3} className="py-1 text-center font-medium text-green-400/80 tracking-wider">
            PUT
          </th>
        </tr>
        <tr className="border-b border-border/50 bg-muted/20 text-[9px] text-muted-foreground/60">
          <th className="w-10 py-0.5 text-center">OI%</th>
          <th className="w-14 py-0.5 text-right pr-1">OI</th>
          <th className="w-14 py-0.5 text-right pr-1">LTP</th>
          <th className="w-16 py-0.5 text-center"></th>
          <th className="w-14 py-0.5 text-left pl-1">LTP</th>
          <th className="w-14 py-0.5 text-left pl-1">OI</th>
          <th className="w-10 py-0.5 text-center">OI%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((entry) => (
          <OptionChainRow
            key={entry.strikePrice}
            entry={entry}
            maxCallOi={maxCallOi}
            maxPutOi={maxPutOi}
            isAtm={entry.strikePrice === atmStrike}
            isLive={liveStrikeSet.has(entry.strikePrice)}
          />
        ))}
      </tbody>
    </table>
  );
}
