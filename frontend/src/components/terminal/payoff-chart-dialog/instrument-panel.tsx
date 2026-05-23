import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLotSize } from "@/lib/lot-sizes";
import type { UnderlyingPayoffGroup, DisplayItem } from "./use-payoff-data";
import type { IndexPrices } from "@/hooks/use-indices-feed";

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function fmtPnl(v: number) {
  return (v >= 0 ? "+" : "-") + INR.format(Math.abs(v));
}

function fmtExpiryShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${String(d).padStart(2, "0")} ${months[m - 1]}`;
}

function fmtItemLabel(item: DisplayItem): string {
  const lots = Math.round(Math.abs(item.quantity) / getLotSize(item.tradingSymbol));
  if (item.contract) {
    return `${lots} x ${fmtExpiryShort(item.contract.expiry)} ${INR.format(item.contract.strikePrice)} ${item.contract.instrumentType}`;
  }
  return `${Math.abs(item.quantity)} x ${item.tradingSymbol}`;
}

interface InstrumentPanelProps {
  groups: UnderlyingPayoffGroup[];
  selectedUnderlying: string;
  feed: IndexPrices;
  onSelect: (underlying: string) => void;
}

export function InstrumentPanel({ groups, selectedUnderlying, feed, onSelect }: InstrumentPanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(underlying: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(underlying)) next.delete(underlying);
      else next.add(underlying);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto p-3">
      {groups.map((group) => {
        const isSelected = group.underlying === selectedUnderlying;
        const isCollapsed = collapsed.has(group.underlying);
        const quote = group.feedKey ? feed[group.feedKey] : null;
        const spot = quote?.ltp ?? null;
        const netChange = quote?.netChange ?? null;
        const pctStr = spot != null && netChange != null
          ? ((netChange / Math.max(1, spot - netChange)) * 100).toFixed(2) + "%"
          : null;

        return (
          <div
            key={group.underlying}
            className={cn(
              "overflow-hidden rounded-lg border transition-colors",
              isSelected ? "border-primary/40 bg-primary/5" : "border-border/50",
            )}
          >
            {/* Group header */}
            <div
              className="flex cursor-pointer items-center justify-between px-3 py-2.5 hover:bg-muted/10"
              onClick={() => onSelect(group.underlying)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{group.underlying}</span>
                {spot != null && (
                  <span className="tabular-nums text-[13px] text-foreground">{INR.format(spot)}</span>
                )}
                {pctStr != null && (
                  <span className={cn(
                    "text-[12px] font-medium",
                    (netChange ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500",
                  )}>
                    {(netChange ?? 0) >= 0 ? "+" : ""}{pctStr}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className={cn(
                  "font-mono tabular-nums text-sm font-semibold",
                  group.totalPnl >= 0 ? "text-emerald-500" : "text-rose-500",
                )}>
                  {fmtPnl(group.totalPnl)}
                </span>
                <button
                  className="p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); toggleCollapse(group.underlying); }}
                >
                  <ChevronDown className={cn(
                    "size-4 transition-transform duration-150",
                    !isCollapsed && "rotate-180",
                  )} />
                </button>
              </div>
            </div>

            {/* Expanded positions */}
            {!isCollapsed && (
              <div className="border-t border-border/30">
                {/* Sub-header */}
                <div className="flex items-center justify-between px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  <span>F&amp;O Instruments</span>
                  <span>P&amp;L</span>
                </div>

                {/* Position rows */}
                {group.items.map((item) => {
                  const isBuyer = item.quantity >= 0;
                  return (
                    <div
                      key={item.instrumentToken + item.tradingSymbol}
                      className="flex items-center justify-between px-3 py-1.5 border-t border-border/20"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* B / S badge */}
                        <span className={cn(
                          "shrink-0 flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold",
                          isBuyer
                            ? "bg-sky-600/20 text-sky-400"
                            : "bg-rose-600/20 text-rose-400",
                        )}>
                          {isBuyer ? "B" : "S"}
                        </span>
                        <span className="truncate text-[12px] tabular-nums">
                          {fmtItemLabel(item)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className={cn(
                          "text-[12px] font-mono tabular-nums font-medium",
                          item.pnl >= 0 ? "text-emerald-500" : "text-rose-500",
                        )}>
                          {fmtPnl(item.pnl)}
                        </span>
                        <ChevronDown className="size-3 text-muted-foreground/50" />
                      </div>
                    </div>
                  );
                })}

                {/* Total row */}
                <div className="flex items-center justify-between border-t border-border/30 bg-muted/10 px-3 py-1.5">
                  <span className="text-[11px] text-muted-foreground">Total</span>
                  <span className={cn(
                    "text-[12px] font-mono tabular-nums font-semibold",
                    group.totalPnl >= 0 ? "text-emerald-500" : "text-rose-500",
                  )}>
                    {fmtPnl(group.totalPnl)}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
