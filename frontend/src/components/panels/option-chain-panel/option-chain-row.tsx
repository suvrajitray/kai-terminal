import { cn } from "@/lib/utils";
import type { OptionChainEntry } from "@/types";

interface Props {
  entry: OptionChainEntry;
  maxCallOi: number;
  maxPutOi: number;
  isAtm: boolean;
  isLive: boolean;
}

function formatLtp(ltp: number | undefined): string {
  if (ltp === undefined || ltp === 0) return "—";
  return ltp.toFixed(2);
}

function formatOi(oi: number | undefined): string {
  if (!oi) return "—";
  if (oi >= 100_000) return `${(oi / 100_000).toFixed(1)}L`;
  if (oi >= 1_000) return `${(oi / 1_000).toFixed(0)}K`;
  return String(oi);
}

export function OptionChainRow({ entry, maxCallOi, maxPutOi, isAtm, isLive }: Props) {
  const callLtp = entry.callOptions?.marketData?.ltp;
  const callOi  = entry.callOptions?.marketData?.oi ?? 0;
  const putLtp  = entry.putOptions?.marketData?.ltp;
  const putOi   = entry.putOptions?.marketData?.oi ?? 0;

  const callOiPct = maxCallOi > 0 ? Math.round((callOi / maxCallOi) * 100) : 0;
  const putOiPct  = maxPutOi  > 0 ? Math.round((putOi  / maxPutOi)  * 100) : 0;

  return (
    <tr
      className={cn(
        "border-b border-border/30 text-xs transition-colors",
        isAtm ? "bg-muted/50" : "hover:bg-muted/20",
        !isLive && "[&>td]:opacity-55",
      )}
    >
      {/* Call OI bar — fills from right toward strike */}
      <td className="w-10 px-1 py-1">
        <div className="relative h-2.5 w-full overflow-hidden rounded-sm bg-muted/20">
          <div
            className="absolute right-0 h-full rounded-sm bg-red-500/40 transition-[width]"
            style={{ width: `${callOiPct}%` }}
          />
        </div>
      </td>

      {/* Call OI */}
      <td className="w-14 px-1 py-1 text-right font-mono text-muted-foreground tabular-nums">
        {formatOi(callOi)}
      </td>

      {/* Call LTP */}
      <td className={cn("w-14 px-1 py-1 text-right font-mono tabular-nums font-medium", callLtp ? "text-red-400" : "text-muted-foreground/50")}>
        {formatLtp(callLtp)}
      </td>

      {/* Strike */}
      <td className={cn("w-16 px-1 py-1 text-center font-mono tabular-nums", isAtm ? "font-bold text-foreground" : "text-muted-foreground")}>
        {entry.strikePrice.toLocaleString("en-IN")}
      </td>

      {/* Put LTP */}
      <td className={cn("w-14 px-1 py-1 text-left font-mono tabular-nums font-medium", putLtp ? "text-green-400" : "text-muted-foreground/50")}>
        {formatLtp(putLtp)}
      </td>

      {/* Put OI */}
      <td className="w-14 px-1 py-1 text-left font-mono text-muted-foreground tabular-nums">
        {formatOi(putOi)}
      </td>

      {/* Put OI bar — fills from left toward strike */}
      <td className="w-10 px-1 py-1">
        <div className="relative h-2.5 w-full overflow-hidden rounded-sm bg-muted/20">
          <div
            className="absolute left-0 h-full rounded-sm bg-green-500/40 transition-[width]"
            style={{ width: `${putOiPct}%` }}
          />
        </div>
      </td>
    </tr>
  );
}
