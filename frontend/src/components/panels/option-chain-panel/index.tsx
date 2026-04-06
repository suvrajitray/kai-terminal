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
    scrollSignal,
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

  // Scroll ATM row to vertical center only on initial load, underlying/expiry change,
  // or manual refresh — NOT on the 60s auto-refresh (scrollSignal won't change then)
  useEffect(() => {
    if (scrollSignal === 0 || atmStrike === 0) return;
    const container = scrollRef.current;
    if (!container) return;
    const id = requestAnimationFrame(() => {
      const atm = container.querySelector<HTMLElement>('[data-atm="true"]');
      if (!atm) return;
      container.scrollTop = atm.offsetTop - container.clientHeight / 2 + atm.offsetHeight / 2;
    });
    return () => cancelAnimationFrame(id);
  }, [scrollSignal, atmStrike]);

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
            const next = Math.max(350, Math.min(550, startW + delta));
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
      {/* Header — two rows below 2xl, one row at 2xl+; mirrors StatsBar layout */}
      <div className="flex flex-col 2xl:flex-row shrink-0 border-b border-border bg-muted/40">
        {/* Row 1 (2xl: left) — selectors */}
        <div className="flex h-9 items-center gap-1.5 flex-1 px-2">
          <select
            value={underlying}
            onChange={(e) => setUnderlying(e.target.value)}
            className="h-6 rounded border border-border/60 bg-background px-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {underlyings.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
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
        </div>

        {/* Row 2 (2xl: right) — controls; subtle top border only below 2xl */}
        <div className="flex h-9 items-center gap-1.5 shrink-0 px-2 2xl:ml-auto border-t border-border/40 2xl:border-t-0">
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

      {/* Stats footer */}
      <div className="flex shrink-0 flex-col border-t border-border bg-background">
        {/* Row 1: Spot · ATM · IV · PCR · IVR */}
        <div className="flex h-8 items-center gap-3 border-b border-border/20 px-3">
          <FooterStat label="Spot" value={spotPrice > 0 ? spotPrice.toFixed(1) : "—"} />
          <Sep />
          <FooterStat label="ATM" value={atmStrike > 0 ? String(atmStrike) : "—"} />
          {atmIv !== null && (
            <>
              <Sep />
              <FooterStat label="IV" value={`${atmIv.toFixed(1)}%`} valueClass="text-amber-400" />
            </>
          )}
          {pcr !== null && (
            <>
              <Sep />
              <FooterStat
                label="PCR"
                value={pcr.toFixed(2)}
                valueClass={pcr >= 1 ? "text-emerald-400" : "text-rose-400"}
              />
            </>
          )}
          {ivRank !== null && ivHistoryDays >= 10 && (
            <>
              <Sep />
              <FooterStat
                label="IVR"
                value={ivRank.toFixed(0)}
                valueClass={ivRank >= 50 ? "text-emerald-400" : ivRank >= 30 ? "text-amber-400" : "text-rose-400"}
                title={`IV Rank ${ivRank.toFixed(0)}/100 — higher than ${ivPercentile?.toFixed(0)}% of past ${ivHistoryDays} days`}
              />
            </>
          )}
          {ivHistoryDays > 0 && ivHistoryDays < 10 && (
            <>
              <Sep />
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/30">IVR collecting…</span>
            </>
          )}
        </div>

        {/* Row 2: Expected Move · Max Pain */}
        <div className="flex h-8 items-center gap-3 border-b border-border/20 px-3">
          {expectedMovePct !== null && expectedMovePts !== null ? (
            <span
              className="flex items-center gap-1.5"
              title="ATM straddle price ÷ spot — market's implied range to expiry"
            >
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">±Move</span>
              <span className="font-mono text-[11px] font-semibold tabular-nums text-sky-400">
                {expectedMovePct.toFixed(2)}%
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40">
                {Math.round(expectedMovePts)} pts
              </span>
            </span>
          ) : (
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Move —</span>
          )}
          {maxPain !== null && (
            <>
              <Sep />
              <MaxPainStat maxPain={maxPain} spotPrice={spotPrice} />
            </>
          )}
        </div>

        {/* Row 3: Delta-neutral hedge */}
        {netDelta !== undefined && (
          <div className="flex h-8 items-center gap-2 bg-muted/30 px-3">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40 shrink-0">Δ Hedge</span>
            <Sep />
            {hedgeSuggestion === null ? (
              <span className="flex items-center gap-1.5">
                <span className={cn(
                  "font-mono text-[11px] font-semibold tabular-nums",
                  Math.abs(netDelta) < 1 ? "text-emerald-400" : "text-muted-foreground/60"
                )}>
                  {netDelta > 0 ? "+" : ""}{netDelta.toFixed(1)}
                </span>
                <span className="text-[10px] text-emerald-400/60">Balanced</span>
              </span>
            ) : (
              <span className="flex items-center gap-2 overflow-hidden">
                {/* Current delta — problem */}
                <span className={cn(
                  "font-mono text-[11px] font-semibold tabular-nums shrink-0",
                  netDelta < 0 ? "text-rose-400" : "text-amber-400"
                )}>
                  {netDelta > 0 ? "+" : ""}{netDelta.toFixed(1)}
                </span>
                <span className="text-muted-foreground/30 shrink-0">→</span>
                {/* Suggestion pill */}
                <span className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
                  hedgeSuggestion.side === "PE"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-rose-500/15 text-rose-400"
                )}>
                  Sell {hedgeSuggestion.lots}L
                </span>
                <span className="font-mono text-[10px] text-foreground/80 shrink-0">
                  {underlying} {hedgeSuggestion.strike}{" "}
                  <span className={hedgeSuggestion.side === "PE" ? "text-emerald-400" : "text-rose-400"}>
                    {hedgeSuggestion.side}
                  </span>
                </span>
                {hedgeSuggestion.ltp > 0 && (
                  <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0">
                    @ {hedgeSuggestion.ltp.toFixed(1)}
                  </span>
                )}
                <span className="text-muted-foreground/30 shrink-0">→</span>
                {/* Result delta */}
                <span className={cn(
                  "font-mono text-[10px] font-medium tabular-nums shrink-0",
                  Math.abs(hedgeSuggestion.residualDelta) < 5 ? "text-emerald-400/80" : "text-amber-400/80"
                )}>
                  Δ {hedgeSuggestion.residualDelta > 0 ? "+" : ""}{hedgeSuggestion.residualDelta.toFixed(1)}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>

    <OptionChainOrderDialog intent={orderIntent} onClose={() => setOrderIntent(null)} />
    </>
  );
}

function Sep() {
  return <span className="text-muted-foreground/20 select-none">|</span>;
}

interface FooterStatProps {
  label: string;
  value: string;
  valueClass?: string;
  title?: string;
}

function FooterStat({ label, value, valueClass, title }: FooterStatProps) {
  return (
    <span className="flex items-center gap-1" title={title}>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">{label}</span>
      <span className={cn("font-mono text-[11px] font-semibold tabular-nums text-foreground", valueClass)}>
        {value}
      </span>
    </span>
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
      className="flex items-center gap-1.5"
      title={`Max Pain ₹${maxPain}. ${saferSide ?? ""}. Market gravitates here by expiry.`}
    >
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Pain</span>
      <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">{maxPain}</span>
      {absDist !== null && absDist > 0 && (
        <span className={cn(
          "font-mono text-[10px]",
          distance! > 0 ? "text-emerald-400/70" : "text-rose-400/70",
        )}>
          {arrow}{absDist} pts
        </span>
      )}
    </span>
  );
}
