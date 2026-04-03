import { useState, useEffect, useRef } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { useOptionChain } from "./use-option-chain";
import { OptionChainTable } from "./option-chain-table";
import { OptionChainOrderDialog, type OrderIntent } from "./option-chain-order-dialog";

interface Props {
  width: number;
  onResize?: (width: number) => void;
  onClose?: () => void;
}

export function OptionChainPanel({ width, onResize, onClose }: Props) {
  const {
    underlying, setUnderlying,
    expiry, setExpiry,
    expiries,
    visibleRows,
    hasMoreLow,
    hasMoreHigh,
    loadMoreLow,
    loadMoreHigh,
    liveStrikeSet,
    atmStrike,
    spotPrice,
    pcr,
    atmIv,
    maxPain,
    loading,
    refresh,
  } = useOptionChain();

  const [orderIntent, setOrderIntent] = useState<OrderIntent | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const underlyings = Object.keys(UNDERLYING_KEYS);

  // Scroll ATM row to vertical center after chain loads
  useEffect(() => {
    if (loading || atmStrike === 0) return;
    const container = scrollRef.current;
    if (!container) return;
    // Wait one frame for the DOM to paint the rows
    const id = requestAnimationFrame(() => {
      const atm = container.querySelector<HTMLElement>('[data-atm="true"]');
      if (!atm) return;
      container.scrollTop = atm.offsetTop - container.clientHeight / 2 + atm.offsetHeight / 2;
    });
    return () => cancelAnimationFrame(id);
  }, [loading, atmStrike]);

  return (
    <>
    <div className="relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-background" style={{ width }}>
      {/* Drag handle — left edge */}
      <div
        className="absolute left-0 top-0 z-20 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/40 active:bg-primary/60 transition-colors"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = width;
          const onMove = (ev: MouseEvent) => {
            const delta = startX - ev.clientX;
            const next = Math.max(320, Math.min(700, startW + delta));
            onResize?.(next);
          };
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      />
      {/* Header — single h-9 row matching StatsBar height */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border bg-muted/40 px-2">
        {/* Underlying selector */}
        <select
          value={underlying}
          onChange={(e) => setUnderlying(e.target.value)}
          className="h-6 rounded border border-border/60 bg-background px-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {underlyings.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Expiry selector */}
        <select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="h-6 w-28 rounded border border-border/60 bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {expiries.map((exp) => (
            <option key={exp} value={exp}>{exp}</option>
          ))}
          {expiries.length === 0 && <option value="">—</option>}
        </select>

        <div className="flex-1" />

        {/* Refresh */}
        <Button
          size="icon"
          variant="ghost"
          className="size-6 shrink-0"
          onClick={refresh}
          disabled={loading}
          title="Refresh chain"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
        </Button>

        {/* Close */}
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={onClose}
            title="Close option chain"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      {/* Chain table — scrollable */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading && visibleRows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            Loading…
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            No data
          </div>
        ) : (
          <>
            {/* Load more — top (lower strikes) */}
            <div className="border-b border-border/30 px-3 py-2">
              {hasMoreLow ? (
                <button
                  onClick={loadMoreLow}
                  className="w-full rounded border border-border/40 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                >
                  Load 15 more strikes
                </button>
              ) : (
                <p className="text-center text-[10px] text-muted-foreground/50">
                  All lower strikes loaded
                </p>
              )}
            </div>

            <OptionChainTable
              rows={visibleRows}
              atmStrike={atmStrike}
              spotPrice={spotPrice}
              underlying={underlying}
              liveStrikeSet={liveStrikeSet}
              onOrder={setOrderIntent}
            />

            {/* Load more — bottom (higher strikes) */}
            <div className="border-t border-border/30 px-3 py-2">
              {hasMoreHigh ? (
                <button
                  onClick={loadMoreHigh}
                  className="w-full rounded border border-border/40 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                >
                  Load 15 more strikes
                </button>
              ) : (
                <p className="text-center text-[10px] text-muted-foreground/50">
                  All higher strikes loaded
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Stats footer — h-8 matching orders panel header */}
      <div className="flex h-8 shrink-0 items-center gap-3 border-t border-border bg-muted/40 px-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground">Spot</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {spotPrice > 0 ? spotPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
          </span>
        </span>
        <span className="text-muted-foreground/30">·</span>
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground">ATM</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {atmStrike > 0 ? atmStrike.toLocaleString("en-IN") : "—"}
          </span>
        </span>
        {atmIv !== null && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground">IV</span>
              <span className="font-mono font-medium tabular-nums text-amber-400">
                {atmIv.toFixed(1)}%
              </span>
            </span>
          </>
        )}
        {pcr !== null && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground">PCR</span>
              <span className={cn("font-mono font-medium tabular-nums", pcr >= 1 ? "text-green-400" : "text-red-400")}>
                {pcr.toFixed(2)}
              </span>
            </span>
          </>
        )}
        {maxPain !== null && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground">Pain</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {maxPain.toLocaleString("en-IN")}
              </span>
            </span>
          </>
        )}
      </div>
    </div>

    <OptionChainOrderDialog intent={orderIntent} onClose={() => setOrderIntent(null)} />
    </>
  );
}
