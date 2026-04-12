import React from "react";
import { cn } from "@/lib/utils";
import type { OptionChainEntry } from "@/types";
import type { OrderIntent } from "@/components/panels/order-dialog";

interface Props {
  entry: OptionChainEntry;
  isAtm: boolean;
  isLive: boolean;
  spotPrice: number;
  underlying: string;
  maxOi: number;
  onOrder: (intent: OrderIntent) => void;
}

function formatLtp(ltp: number | undefined): string {
  if (!ltp) return "—";
  return ltp.toFixed(2);
}

function formatDelta(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return "—";
  return delta.toFixed(2);
}

function formatOi(oi: number | undefined): string {
  if (!oi) return "—";
  if (oi >= 100_000) return `${(oi / 100_000).toFixed(1)}L`;
  if (oi >= 1_000)   return `${(oi / 1_000).toFixed(0)}K`;
  return String(oi);
}

function formatOiChange(change: number): string {
  if (change === 0) return "";
  const abs = Math.abs(change);
  const str = abs >= 100_000 ? `${(abs / 100_000).toFixed(1)}L`
             : abs >= 1_000   ? `${(abs / 1_000).toFixed(0)}K`
             : String(abs);
  return (change > 0 ? "+" : "−") + str;
}


export function OptionChainRow({ entry, isAtm, isLive, spotPrice, underlying, maxOi, onOrder }: Props) {
  const callLtp      = entry.callOptions?.marketData?.ltp;
  const putLtp       = entry.putOptions?.marketData?.ltp;
  const callDelta    = entry.callOptions?.optionGreeks?.delta;
  const putDelta     = entry.putOptions?.optionGreeks?.delta;
  const callOi       = entry.callOptions?.marketData?.oi;
  const putOi        = entry.putOptions?.marketData?.oi;
  const callPrevOi   = entry.callOptions?.marketData?.prevOi ?? 0;
  const putPrevOi    = entry.putOptions?.marketData?.prevOi  ?? 0;
  const callOiChange = callOi !== undefined ? callOi - callPrevOi : 0;
  const putOiChange  = putOi  !== undefined ? putOi  - putPrevOi  : 0;

  const callItm = spotPrice > 0 && entry.strikePrice < spotPrice;
  const putItm  = spotPrice > 0 && entry.strikePrice > spotPrice;

  const callBarPct = maxOi > 0 && callOi ? (callOi / maxOi) * 100 : 0;
  const putBarPct  = maxOi > 0 && putOi  ? (putOi  / maxOi) * 100 : 0;

  // Full-row OI bars (Zerodha-style) — single 2px bar at row bottom per side.
  // Call side anchored left (spans 41% of row width); put side anchored right.
  const rowBgStyle: React.CSSProperties = {};
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  if (callBarPct > 0) {
    images.push('linear-gradient(rgba(239,68,68,0.4),rgba(239,68,68,0.4))');
    sizes.push(`${(callBarPct * 0.41).toFixed(2)}% 2px`);
    positions.push('left bottom');
  }
  if (putBarPct > 0) {
    images.push('linear-gradient(rgba(34,197,94,0.4),rgba(34,197,94,0.4))');
    sizes.push(`${(putBarPct * 0.41).toFixed(2)}% 2px`);
    positions.push('right bottom');
  }
  if (images.length > 0) {
    rowBgStyle.backgroundImage = images.join(',');
    rowBgStyle.backgroundRepeat = 'no-repeat';
    rowBgStyle.backgroundSize = sizes.join(',');
    rowBgStyle.backgroundPosition = positions.join(',');
  }

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
        "group h-9 border-b border-border/30 text-[10px] transition-colors",
        isAtm ? "bg-muted/50" : "hover:bg-muted/20",
        !isLive && "[&>td]:opacity-55",
      )}
      style={rowBgStyle}
    >
      {/* Call OI + ΔOI → B button on hover */}
      <td className={cn(
        "px-1 py-1 text-right font-mono tabular-nums",
        callItm ? "bg-red-500/10" : "",
      )}>
        <span className="group-hover:hidden flex flex-col items-end leading-none gap-0.5">
          <span className="text-muted-foreground/70">{formatOi(callOi)}</span>
          {callOiChange !== 0 && (
            <span className={cn("text-[9px]", callOiChange > 0 ? "text-emerald-400/80" : "text-rose-400/80")}>
              {formatOiChange(callOiChange)}
            </span>
          )}
        </span>
        <span className="hidden group-hover:flex w-full justify-end">
          <button
            onClick={() => triggerOrder("CE", "Buy")}
            className={cn(
              "h-6 w-full cursor-pointer rounded text-[10px] font-bold text-white",
              callItm ? "bg-green-900/70 hover:bg-green-900" : "bg-green-600 hover:bg-green-500",
            )}
          >
            B
          </button>
        </span>
      </td>

      {/* Call Δ → S button on hover */}
      <td className={cn(
        "px-1 py-1 text-right font-mono tabular-nums",
        callItm ? "bg-red-500/10 text-muted-foreground/70" : "text-muted-foreground/40",
      )}>
        <span className="group-hover:hidden">{formatDelta(callDelta)}</span>
        <span className="hidden group-hover:flex w-full justify-end">
          <button
            onClick={() => triggerOrder("CE", "Sell")}
            className={cn(
              "h-6 w-full cursor-pointer rounded text-[10px] font-bold text-white",
              callItm ? "bg-red-900/70 hover:bg-red-900" : "bg-red-600 hover:bg-red-500",
            )}
          >
            S
          </button>
        </span>
      </td>

      {/* Call LTP */}
      <td className={cn(
        "px-1 py-1 text-right font-mono tabular-nums font-medium text-[11px]",
        callItm ? "bg-red-500/10" : "opacity-40",
        callLtp ? "text-rose-400" : "text-muted-foreground/50",
      )}>
        {formatLtp(callLtp)}
      </td>

      {/* Strike */}
      <td className={cn("px-1 py-1 text-center font-mono tabular-nums text-[11px]", isAtm ? "font-bold text-foreground" : "text-muted-foreground")}>
        {entry.strikePrice}
      </td>

      {/* Put LTP */}
      <td className={cn(
        "px-1 py-1 text-left font-mono tabular-nums font-medium text-[11px]",
        putItm ? "bg-green-500/10" : "opacity-40",
        putLtp ? "text-emerald-400" : "text-muted-foreground/50",
      )}>
        {formatLtp(putLtp)}
      </td>

      {/* Put Δ → S button on hover */}
      <td className={cn(
        "px-1 py-1 text-left font-mono tabular-nums",
        putItm ? "bg-green-500/10 text-muted-foreground/70" : "text-muted-foreground/40",
      )}>
        <span className="group-hover:hidden">{formatDelta(putDelta)}</span>
        <span className="hidden group-hover:flex w-full justify-start">
          <button
            onClick={() => triggerOrder("PE", "Sell")}
            className={cn(
              "h-6 w-full cursor-pointer rounded text-[10px] font-bold text-white",
              putItm ? "bg-red-900/70 hover:bg-red-900" : "bg-red-600 hover:bg-red-500",
            )}
          >
            S
          </button>
        </span>
      </td>

      {/* Put OI + ΔOI → B button on hover */}
      <td className={cn(
        "px-1 py-1 text-left font-mono tabular-nums",
        putItm ? "bg-green-500/10" : "",
      )}>
        <span className="group-hover:hidden flex flex-col items-start leading-none gap-0.5">
          <span className="text-muted-foreground/70">{formatOi(putOi)}</span>
          {putOiChange !== 0 && (
            <span className={cn("text-[9px]", putOiChange > 0 ? "text-emerald-400/80" : "text-rose-400/80")}>
              {formatOiChange(putOiChange)}
            </span>
          )}
        </span>
        <span className="hidden group-hover:flex w-full justify-start">
          <button
            onClick={() => triggerOrder("PE", "Buy")}
            className={cn(
              "h-6 w-full cursor-pointer rounded text-[10px] font-bold text-white",
              putItm ? "bg-green-900/70 hover:bg-green-900" : "bg-green-600 hover:bg-green-500",
            )}
          >
            B
          </button>
        </span>
      </td>
    </tr>
  );
}
