import { useState, useEffect, useRef } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { useOptionChain } from "./use-option-chain";
import { OptionChainTable } from "./option-chain-table";
import { OptionChainOrderDialog, type OrderIntent } from "./option-chain-order-dialog";
import { useOptionContractsStore } from "@/stores/option-contracts-store";

interface Props {
  width: number;
  onResize?: (width: number) => void;
  onClose?: () => void;
  netDelta?: number;
}

export function OptionChainPanel({ width, onResize, onClose, netDelta }: Props) {
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
    expectedMovePct,
    expectedMovePts,
    ivRank,
    ivPercentile,
    ivHistoryDays,
    loading,
    refresh,
  } = useOptionChain();

  const [orderIntent, setOrderIntent] = useState<OrderIntent | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const underlyings = Object.keys(UNDERLYING_KEYS);

  const getContracts = useOptionContractsStore((s) => s.getContracts);
  const lotSize = getContracts(underlying)[0]?.lotSize ?? 75;

  const hedgeSuggestion = (() => {
    if (netDelta === undefined || atmStrike === 0 || visibleRows.length === 0) return null;
    const threshold = lotSize * 0.15; // ignore if less than 0.15 delta per lot
    if (Math.abs(netDelta) < threshold) return null;

    const needPositiveDelta = netDelta < 0;
    const side = needPositiveDelta ? "PE" : "CE";

    // Find the strike with delta closest to |netDelta| / lotSize (ideal per-share delta per lot)
    const targetDeltaPerShare = Math.abs(netDelta) / lotSize;
    const candidates = visibleRows
      .map((row) => {
        const opt = needPositiveDelta ? row.putOptions : row.callOptions;
        const delta = Math.abs(opt?.optionGreeks?.delta ?? 0);
        const ltp = opt?.marketData?.ltp ?? 0;
        return { strike: row.strikePrice, delta, ltp };
      })
      .filter((c) => c.delta >= 0.15 && c.delta <= 0.65);

    if (candidates.length === 0) return null;
    const best = candidates.reduce((prev, curr) =>
      Math.abs(curr.delta - targetDeltaPerShare) < Math.abs(prev.delta - targetDeltaPerShare) ? curr : prev
    );
    const lots = Math.max(1, Math.round(Math.abs(netDelta) / (best.delta * lotSize)));
    const residualDelta = netDelta + (needPositiveDelta ? 1 : -1) * best.delta * lots * lotSize;
    return { side, strike: best.strike, lots, ltp: best.ltp, residualDelta };
  })();

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

      {/* Stats footer — two rows */}
      <div className="flex shrink-0 flex-col border-t border-border bg-muted/40 text-[11px]">
        {/* Row 1: Spot · ATM · IV · PCR */}
        <div className="flex h-7 items-center gap-3 border-b border-border/40 px-3">
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground">Spot</span>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {spotPrice > 0 ? spotPrice.toFixed(1) : "—"}
            </span>
          </span>
          <span className="text-muted-foreground/30">|</span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground">ATM</span>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {atmStrike > 0 ? atmStrike : "—"}
            </span>
          </span>
          {atmIv !== null && (
            <>
              <span className="text-muted-foreground/30">|</span>
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
              <span className="text-muted-foreground/30">|</span>
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">PCR</span>
                <span className={cn("font-mono font-medium tabular-nums", pcr >= 1 ? "text-green-400" : "text-red-400")}>
                  {pcr.toFixed(2)}
                </span>
              </span>
            </>
          )}
          {ivRank !== null && ivHistoryDays >= 10 && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span
                className="flex items-center gap-1"
                title={`IV Rank ${ivRank.toFixed(0)}/100 — current IV is higher than ${ivPercentile?.toFixed(0)}% of the past ${ivHistoryDays} days`}
              >
                <span className="text-muted-foreground">IVR</span>
                <span className={cn(
                  "font-mono font-medium tabular-nums",
                  ivRank >= 50 ? "text-green-400" :
                  ivRank >= 30 ? "text-amber-400" :
                  "text-red-400",
                )}>
                  {ivRank.toFixed(0)}
                </span>
              </span>
            </>
          )}
          {ivHistoryDays > 0 && ivHistoryDays < 10 && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-[10px] text-muted-foreground/40">IVR collecting…</span>
            </>
          )}
        </div>
        {/* Row 2: Expected Move · Max Pain distance */}
        <div className="flex h-7 items-center gap-3 border-b border-border/40 px-3">
          {expectedMovePct !== null && expectedMovePts !== null ? (
            <span
              className="flex items-center gap-1"
              title="Implied expected move to expiry = ATM straddle price ÷ spot. Market's own estimate of the range."
            >
              <span className="text-muted-foreground">±Move</span>
              <span className="font-mono font-medium tabular-nums text-sky-400">
                {expectedMovePct.toFixed(2)}%
              </span>
              <span className="text-muted-foreground/50">
                ({Math.round(expectedMovePts)} pts)
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground/40">Expected move —</span>
          )}
          {maxPain !== null && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <MaxPainStat maxPain={maxPain} spotPrice={spotPrice} />
            </>
          )}
        </div>
        {/* Row 3: Delta-neutral hedge suggestion */}
        {netDelta !== undefined && (
          <div className="flex h-7 items-center gap-2 px-3">
            <span className="text-muted-foreground">ΔHedge</span>
            {hedgeSuggestion === null ? (
              <span className="font-mono text-[10px] text-green-400/70">
                {netDelta === 0 ? "Balanced" : `${netDelta > 0 ? "+" : ""}${netDelta.toFixed(1)} — Balanced`}
              </span>
            ) : (
              <>
                <span className={cn("font-mono font-medium tabular-nums text-[10px]", netDelta < 0 ? "text-red-400" : "text-amber-400")}>
                  {netDelta > 0 ? "+" : ""}{netDelta.toFixed(1)}
                </span>
                <span className="text-muted-foreground/30">→</span>
                <span className="font-mono text-[10px] text-foreground">
                  Sell {hedgeSuggestion.lots}L {underlying} {hedgeSuggestion.strike}{" "}
                  <span className={hedgeSuggestion.side === "PE" ? "text-green-400" : "text-red-400"}>
                    {hedgeSuggestion.side}
                  </span>
                </span>
                {hedgeSuggestion.ltp > 0 && (
                  <span className="text-muted-foreground/50 text-[10px]">
                    @ {hedgeSuggestion.ltp.toFixed(1)}
                  </span>
                )}
                <span className="text-muted-foreground/30">→</span>
                <span className={cn(
                  "font-mono text-[10px]",
                  Math.abs(hedgeSuggestion.residualDelta) < 5 ? "text-green-400/70" : "text-amber-400/70"
                )}>
                  Δ {hedgeSuggestion.residualDelta > 0 ? "+" : ""}{hedgeSuggestion.residualDelta.toFixed(1)}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>

    <OptionChainOrderDialog intent={orderIntent} onClose={() => setOrderIntent(null)} />
    </>
  );
}

interface MaxPainStatProps {
  maxPain: number;
  spotPrice: number;
}

function MaxPainStat({ maxPain, spotPrice }: MaxPainStatProps) {
  const distance = spotPrice > 0 ? Math.round(maxPain - spotPrice) : null;
  // Positive = spot below max pain (price needs to rise to max pain — PEs safer)
  // Negative = spot above max pain (price needs to fall to max pain — CEs safer)
  const absDist = distance !== null ? Math.abs(distance) : null;
  const arrow = distance === null ? "" : distance > 0 ? "↑" : "↓";
  const saferSide = distance === null ? null : distance > 0 ? "CE safe" : "PE safe";

  return (
    <span
      className="flex items-center gap-1"
      title={`Max Pain ₹${maxPain}. ${saferSide ?? ""}. Market gravitates here by expiry.`}
    >
      <span className="text-muted-foreground">Pain</span>
      <span className="font-mono font-medium tabular-nums text-foreground">
        {maxPain}
      </span>
      {absDist !== null && absDist > 0 && (
        <span className={cn(
          "text-[10px] font-mono",
          distance! > 0 ? "text-green-400/70" : "text-red-400/70",
        )}>
          {arrow}{absDist} pts
        </span>
      )}
    </span>
  );
}
