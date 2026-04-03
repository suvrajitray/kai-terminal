import { cn } from "@/lib/utils";
import type { OptionChainEntry } from "@/types";
import type { OrderIntent } from "./option-chain-order-dialog";

interface Props {
  entry: OptionChainEntry;
  isAtm: boolean;
  isLive: boolean;
  spotPrice: number;
  underlying: string;
  onOrder: (intent: OrderIntent) => void;
}

function formatLtp(ltp: number | undefined): string {
  if (ltp === undefined || ltp === 0) return "—";
  return ltp.toFixed(2);
}

function formatDelta(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return "—";
  return delta.toFixed(2);
}

export function OptionChainRow({ entry, isAtm, isLive, spotPrice, underlying, onOrder }: Props) {
  const callLtp   = entry.callOptions?.marketData?.ltp;
  const putLtp    = entry.putOptions?.marketData?.ltp;
  const callDelta = entry.callOptions?.optionGreeks?.delta;
  const putDelta  = entry.putOptions?.optionGreeks?.delta;

  const callItm = spotPrice > 0 && entry.strikePrice < spotPrice;
  const putItm  = spotPrice > 0 && entry.strikePrice > spotPrice;

  function triggerOrder(side: "CE" | "PE", transactionType: "Buy" | "Sell") {
    const opt = side === "CE" ? entry.callOptions : entry.putOptions;
    const ltp = opt?.marketData?.ltp ?? 0;
    const key = opt?.instrumentKey;
    if (!key) return;
    onOrder({ instrumentKey: key, side, transactionType, ltp, strike: entry.strikePrice, underlying });
  }

  return (
    <tr
      data-atm={isAtm ? "true" : undefined}
      className={cn(
        "group h-9 border-b border-border/30 text-sm transition-colors",
        isAtm ? "bg-muted/50" : "hover:bg-muted/20",
        !isLive && "[&>td]:opacity-55",
      )}
    >
      {/* Call Delta — shows S + B on hover */}
      <td className={cn(
        "px-2 py-1.5 text-right font-mono tabular-nums text-xs",
        callItm ? "bg-red-500/10 text-muted-foreground/70" : "text-muted-foreground/30",
      )}>
        <span className="group-hover:hidden">{formatDelta(callDelta)}</span>
        <span className="hidden group-hover:inline-flex items-center justify-end gap-1 w-full">
          <button
            onClick={() => triggerOrder("CE", "Sell")}
            className={cn(
              "h-6 w-10 cursor-pointer rounded text-[11px] font-bold text-white",
              callItm ? "bg-red-900/70 text-red-300/60 hover:bg-red-900" : "bg-red-600 hover:bg-red-500",
            )}
          >
            S
          </button>
          <button
            onClick={() => triggerOrder("CE", "Buy")}
            className={cn(
              "h-6 w-10 cursor-pointer rounded text-[11px] font-bold text-white",
              callItm ? "bg-green-900/70 text-green-300/60 hover:bg-green-900" : "bg-green-600 hover:bg-green-500",
            )}
          >
            B
          </button>
        </span>
      </td>

      {/* Call LTP — always visible */}
      <td className={cn(
        "px-3 py-1 text-right font-mono tabular-nums font-medium",
        callItm ? "bg-red-500/10" : "opacity-40",
        callLtp ? "text-red-400" : "text-muted-foreground/50",
      )}>
        {formatLtp(callLtp)}
      </td>

      {/* Strike */}
      <td className={cn("px-3 py-1 text-center font-mono tabular-nums", isAtm ? "font-bold text-foreground" : "text-muted-foreground")}>
        {entry.strikePrice}
      </td>

      {/* Put LTP — always visible */}
      <td className={cn(
        "px-3 py-1 text-left font-mono tabular-nums font-medium",
        putItm ? "bg-green-500/10" : "opacity-40",
        putLtp ? "text-green-400" : "text-muted-foreground/50",
      )}>
        {formatLtp(putLtp)}
      </td>

      {/* Put Delta — shows B + S on hover */}
      <td className={cn(
        "px-2 py-1.5 text-left font-mono tabular-nums text-xs",
        putItm ? "bg-green-500/10 text-muted-foreground/70" : "text-muted-foreground/30",
      )}>
        <span className="group-hover:hidden">{formatDelta(putDelta)}</span>
        <span className="hidden group-hover:inline-flex items-center justify-start gap-1 w-full">
          <button
            onClick={() => triggerOrder("PE", "Buy")}
            className={cn(
              "h-6 w-10 cursor-pointer rounded text-[11px] font-bold text-white",
              putItm ? "bg-green-900/70 text-green-300/60 hover:bg-green-900" : "bg-green-600 hover:bg-green-500",
            )}
          >
            B
          </button>
          <button
            onClick={() => triggerOrder("PE", "Sell")}
            className={cn(
              "h-6 w-10 cursor-pointer rounded text-[11px] font-bold text-white",
              putItm ? "bg-red-900/70 text-red-300/60 hover:bg-red-900" : "bg-red-600 hover:bg-red-500",
            )}
          >
            S
          </button>
        </span>
      </td>
    </tr>
  );
}
