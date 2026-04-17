import React, { useCallback, useEffect, useReducer, useRef } from "react";
import { toast } from "@/lib/toast";
import { RefreshCw, Zap, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { fetchOptionChain, placeMarketOrder, type MarginInstrument } from "@/services/trading-api";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { useDirectMarginEstimate } from "../../use-margin-estimate";
import { type QtyMode } from "@/components/ui/qty-input";
import type { OptionChainEntry } from "@/types";
import { ChainControls } from "./chain-controls";

// ── Types ────────────────────────────────────────────────────────────────────

type Direction    = "Buy" | "Sell";
type ActionType   = "CE" | "PE" | "BOTH";
type StrategyMode = "straddle" | "strangle";

interface StraddleRow {
  /** For straddle: ceStrike − atmStrike (−N … 0 … +N).
   *  For strangle: ceStrike − atmStrike (always > 0). */
  diff: number;
  ceStrike: number;
  ceLtp?: number;
  ceKey?: string;
  peStrike: number;
  peLtp?: number;
  peKey?: string;
}

// ── Row builder ──────────────────────────────────────────────────────────────

function buildRows(
  chain: OptionChainEntry[],
  spotPrice: number,
  mode: StrategyMode,
): { rows: StraddleRow[]; atmStrike: number | null } {
  if (!chain.length) return { rows: [], atmStrike: null };

  const sorted = [...chain].sort((a, b) => a.strikePrice - b.strikePrice);

  const atmEntry = sorted.reduce((best, e) =>
    Math.abs(e.strikePrice - spotPrice) < Math.abs(best.strikePrice - spotPrice) ? e : best,
  );
  const atmStrike = atmEntry.strikePrice;
  const atmIdx    = sorted.findIndex((e) => e.strikePrice === atmStrike);

  if (mode === "straddle") {
    const rows = sorted.map((entry) => ({
      diff:      entry.strikePrice - atmStrike,
      ceStrike:  entry.strikePrice,
      ceLtp:     entry.callOptions?.marketData?.ltp,
      ceKey:     entry.callOptions?.instrumentKey,
      peStrike:  entry.strikePrice,
      peLtp:     entry.putOptions?.marketData?.ltp,
      peKey:     entry.putOptions?.instrumentKey,
    }));
    return { rows, atmStrike };
  } else {
    const maxPairs = Math.min(atmIdx, sorted.length - atmIdx - 1);
    const rows: StraddleRow[] = [];

    for (let i = 1; i <= maxPairs; i++) {
      const ceEntry = sorted[atmIdx + i];
      const peEntry = sorted[atmIdx - i];
      rows.push({
        diff:     ceEntry.strikePrice - atmStrike,
        ceStrike: ceEntry.strikePrice,
        ceLtp:    ceEntry.callOptions?.marketData?.ltp,
        ceKey:    ceEntry.callOptions?.instrumentKey,
        peStrike: peEntry.strikePrice,
        peLtp:    peEntry.putOptions?.marketData?.ltp,
        peKey:    peEntry.putOptions?.instrumentKey,
      });
    }
    return { rows, atmStrike };
  }
}

// ── Reducer ──────────────────────────────────────────────────────────────────

interface ChainState {
  chain: OptionChainEntry[];
  loading: boolean;
  mode: StrategyMode;
  selectedDiff: number | null;
  direction: Direction;
  acting: ActionType | null;
}

type ChainAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; chain: OptionChainEntry[] }
  | { type: "LOAD_ERROR" }
  | { type: "SET_MODE"; mode: StrategyMode }
  | { type: "SET_SELECTED_DIFF"; diff: number | null }
  | { type: "SET_DIRECTION"; direction: Direction }
  | { type: "EXECUTE_START"; acting: ActionType }
  | { type: "EXECUTE_DONE" };

function chainReducer(state: ChainState, action: ChainAction): ChainState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true };
    case "LOAD_SUCCESS":
      // Clear selectedDiff on new chain data — no separate useEffect needed
      return { ...state, loading: false, chain: action.chain, selectedDiff: null };
    case "LOAD_ERROR":
      return { ...state, loading: false };
    case "SET_MODE":
      // Clear selectedDiff when switching mode — no separate useEffect needed
      return { ...state, mode: action.mode, selectedDiff: null };
    case "SET_SELECTED_DIFF":
      return { ...state, selectedDiff: action.diff };
    case "SET_DIRECTION":
      return { ...state, direction: action.direction };
    case "EXECUTE_START":
      return { ...state, acting: action.acting };
    case "EXECUTE_DONE":
      return { ...state, acting: null };
    default: return state;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  broker: "upstox" | "zerodha";
  underlying: string;
  expiry: string;
  product: "I" | "D";
  quantity: number;
  isActive: boolean;
  qtyValue: string;
  qtyMode: QtyMode;
  lotSize: number;
  onQtyChange: (v: string) => void;
  onToggleMode: () => void;
}

export const ByChainTab = React.memo(function ByChainTab({
  broker, underlying, expiry, product, quantity, isActive,
  qtyValue, qtyMode, lotSize, onQtyChange, onToggleMode,
}: Props) {
  const [chainState, dispatch] = useReducer(chainReducer, {
    chain:        [],
    loading:      false,
    mode:         "strangle",
    selectedDiff: null,
    direction:    "Sell",
    acting:       null,
  });
  const { chain, loading, mode, selectedDiff, direction, acting } = chainState;

  const atmRowRef  = useRef<HTMLTableRowElement | null>(null);
  const scrollRef  = useRef<HTMLDivElement | null>(null);

  const underlyingKey      = UNDERLYING_KEYS[underlying];
  const spotPrice          = chain[0]?.underlyingSpotPrice ?? 0;
  const exchange           = underlyingKey?.startsWith("BSE_") ? "BFO" : "NFO";
  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);

  const { rows, atmStrike } = buildRows(chain, spotPrice, mode);

  const loadChain = useCallback(async () => {
    if (!expiry || !underlyingKey) return;
    dispatch({ type: "LOAD_START" });
    try {
      const data = await fetchOptionChain(underlyingKey, expiry);
      dispatch({ type: "LOAD_SUCCESS", chain: data });
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to load option chain");
      dispatch({ type: "LOAD_ERROR" });
    }
  }, [expiry, underlyingKey]);

  useEffect(() => {
    if (isActive && expiry) loadChain();
  }, [underlying, expiry, isActive, loadChain]);

  useEffect(() => {
    if (!loading && atmRowRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const row       = atmRowRef.current;
      const offset    = row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2;
      container.scrollTop = Math.max(0, offset);
    }
  }, [loading, rows.length, mode]);

  const selected = rows.find((r) => r.diff === selectedDiff) ?? null;

  const isBuy = direction === "Buy";

  const marginInstruments: MarginInstrument[] | null = selected && selected.ceKey && selected.peKey
    ? [
        { instrumentToken: selected.ceKey, quantity, product: product === "D" ? "D" : "I", transactionType: isBuy ? "BUY" : "SELL" },
        { instrumentToken: selected.peKey, quantity, product: product === "D" ? "D" : "I", transactionType: isBuy ? "BUY" : "SELL" },
      ]
    : null;

  const { margin, loading: marginLoading } = useDirectMarginEstimate(marginInstruments, broker);

  function resolveToken(upstoxKey: string): string | null {
    if (broker === "upstox") return upstoxKey;
    const lookup = getByInstrumentKey(upstoxKey);
    return lookup?.contract.zerodhaToken || null;
  }

  async function execute(action: ActionType) {
    if (!selected) { toast.error("Select a row first"); return; }

    const { ceKey, peKey } = selected;

    if ((action === "CE" || action === "BOTH") && !ceKey) {
      toast.error("CE instrument not available"); return;
    }
    if ((action === "PE" || action === "BOTH") && !peKey) {
      toast.error("PE instrument not available"); return;
    }

    const ceToken = ceKey ? resolveToken(ceKey) : null;
    const peToken = peKey ? resolveToken(peKey) : null;

    if ((action === "CE" || action === "BOTH") && !ceToken) {
      toast.error("CE contract not found"); return;
    }
    if ((action === "PE" || action === "BOTH") && !peToken) {
      toast.error("PE contract not found"); return;
    }

    const zerodhaExchange = broker === "zerodha" ? exchange : undefined;
    const orders: Promise<void>[] = [];
    if (action === "CE" || action === "BOTH") orders.push(placeMarketOrder(ceToken!, quantity, direction, product, broker, zerodhaExchange));
    if (action === "PE" || action === "BOTH") orders.push(placeMarketOrder(peToken!, quantity, direction, product, broker, zerodhaExchange));

    dispatch({ type: "EXECUTE_START", acting: action });
    try {
      await Promise.all(orders);
      toast.success("Order placed");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      dispatch({ type: "EXECUTE_DONE" });
    }
  }

  const fmt = (n?: number) => (n != null ? n.toFixed(2) : "—");

  const scrollTargetDiff = mode === "straddle" ? 0 : rows[0]?.diff ?? 0;

  return (
    <div className="space-y-4">
      {/* Strategy toggle + ATM info */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/20 p-1">
          {(["strangle", "straddle"] as StrategyMode[]).map((m) => (
            <button
              key={m}
              onClick={() => dispatch({ type: "SET_MODE", mode: m })}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-semibold transition-all capitalize",
                mode === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-end gap-3 text-[11px]">
          {spotPrice > 0 && (
            <span className="text-muted-foreground">
              Spot <span className="font-semibold text-foreground tabular-nums">{spotPrice.toFixed(2)}</span>
            </span>
          )}
          {atmStrike != null && (
            <>
              <span className="text-border/50">·</span>
              <span className="text-muted-foreground">
                ATM <span className="font-bold text-amber-400 tabular-nums">{atmStrike}</span>
              </span>
            </>
          )}
          <button
            onClick={loadChain}
            disabled={loading}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/40 overflow-hidden">
        {/* Headers */}
        <table className="w-full text-[10px]">
          <thead className="bg-muted/20 border-b border-border/30">
            <tr>
              <th className="py-2 pl-3 w-14 text-left font-semibold uppercase tracking-wider text-muted-foreground/60">
                Diff
              </th>
              <th className="py-2 w-20 text-center font-semibold uppercase tracking-wider text-sky-600/80 dark:text-sky-400/80">
                Call
              </th>
              <th className="py-2 w-20 text-center font-semibold uppercase tracking-wider text-sky-600/60 dark:text-sky-400/60">
                LTP
              </th>
              <th className="py-2 w-20 text-center font-semibold uppercase tracking-wider text-red-600/80 dark:text-red-400/80">
                Put
              </th>
              <th className="py-2 w-20 text-center font-semibold uppercase tracking-wider text-red-600/60 dark:text-red-400/60">
                LTP
              </th>
              <th className="py-2 pr-3 w-20 text-right font-semibold uppercase tracking-wider text-muted-foreground/60">
                Combined
              </th>
            </tr>
          </thead>
        </table>

        {/* Scrollable body */}
        <div ref={scrollRef} className="max-h-[min(280px,35dvh)] overflow-y-auto">
          {loading ? (
            <div className="flex h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
              {expiry ? "No data" : "Select an expiry"}
            </div>
          ) : (
            <table className="w-full">
              <tbody>
                {rows.map((row) => {
                  const isAtmRow   = row.diff === scrollTargetDiff && mode === "straddle";
                  const isSelected = row.diff === selectedDiff;
                  const combined =
                    row.ceLtp != null && row.peLtp != null
                      ? (row.ceLtp + row.peLtp).toFixed(2)
                      : "—";

                  return (
                    <tr
                      key={`${row.ceStrike}-${row.peStrike}`}
                      ref={row.diff === scrollTargetDiff ? (el) => { atmRowRef.current = el; } : undefined}
                      onClick={() => dispatch({ type: "SET_SELECTED_DIFF", diff: isSelected ? null : row.diff })}
                      className={cn(
                        "cursor-pointer border-b border-border/10 last:border-0 transition-colors",
                        isSelected
                          ? "bg-primary/15 hover:bg-primary/20"
                          : isAtmRow
                            ? "bg-amber-500/10 hover:bg-amber-500/15"
                            : "hover:bg-muted/20",
                      )}
                    >
                      {/* DIFF */}
                      <td className="py-2.5 pl-3 w-14">
                        <span
                          className={cn(
                            "text-[11px] tabular-nums font-semibold",
                            row.diff === 0
                              ? "text-amber-600 dark:text-amber-400"
                              : isSelected
                                ? "text-primary"
                                : "text-muted-foreground/70",
                          )}
                        >
                          {row.diff === 0 ? (
                            <span className="flex items-center gap-1">
                              <span className="inline-block size-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                              0
                            </span>
                          ) : (
                            row.diff > 0 ? `+${row.diff}` : row.diff
                          )}
                        </span>
                      </td>

                      {/* CE Strike */}
                      <td className="py-2.5 w-20 text-center">
                        <span
                          className={cn(
                            "text-xs font-bold tabular-nums",
                            row.diff === 0 ? "text-amber-600 dark:text-amber-400" : "text-sky-600/90 dark:text-sky-400/90",
                          )}
                        >
                          {row.ceStrike}
                        </span>
                      </td>

                      {/* CE LTP */}
                      <td className="py-2.5 w-20 text-center tabular-nums font-mono text-[12px] text-sky-600 dark:text-sky-300">
                        {fmt(row.ceLtp)}
                      </td>

                      {/* PE Strike */}
                      <td className="py-2.5 w-20 text-center">
                        <span
                          className={cn(
                            "text-xs font-bold tabular-nums",
                            row.diff === 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600/90 dark:text-red-400/90",
                          )}
                        >
                          {row.peStrike}
                        </span>
                      </td>

                      {/* PE LTP */}
                      <td className="py-2.5 w-20 text-center tabular-nums font-mono text-[12px] text-red-600 dark:text-red-300">
                        {fmt(row.peLtp)}
                      </td>

                      {/* Combined */}
                      <td className="py-2.5 pr-3 w-20 text-right tabular-nums font-mono text-[11px] text-muted-foreground/70">
                        {combined}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Selected row info / placeholder */}
      {selected ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <span className="text-muted-foreground capitalize">{mode}</span>
          {mode === "straddle" ? (
            <span className="font-bold tabular-nums">{selected.ceStrike}</span>
          ) : (
            <>
              <span className="text-sky-600 dark:text-sky-400 font-bold tabular-nums">CE {selected.ceStrike}</span>
              <span className="text-border/50">+</span>
              <span className="text-red-600 dark:text-red-400 font-bold tabular-nums">PE {selected.peStrike}</span>
            </>
          )}
          <span className="text-border/50 mx-0.5">·</span>
          <span className="text-sky-600 dark:text-sky-400 tabular-nums">{fmt(selected.ceLtp)}</span>
          <span className="text-muted-foreground/50">+</span>
          <span className="text-red-600 dark:text-red-400 tabular-nums">{fmt(selected.peLtp)}</span>
          {selected.ceLtp != null && selected.peLtp != null && (
            <>
              <span className="text-border/50 mx-0.5">·</span>
              <span className="text-muted-foreground tabular-nums">
                Combined {(selected.ceLtp + selected.peLtp).toFixed(2)}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="flex h-9 items-center justify-center rounded-lg border border-dashed border-border/40 text-xs text-muted-foreground/50">
          Click a row to select a strike
        </div>
      )}

      {/* Buy/Sell + Qty + Margin row */}
      <ChainControls
        qtyValue={qtyValue}
        qtyMode={qtyMode}
        lotSize={lotSize}
        direction={direction}
        margin={margin}
        marginLoading={marginLoading}
        onQtyChange={onQtyChange}
        onToggleMode={onToggleMode}
        onDirectionChange={(d) => dispatch({ type: "SET_DIRECTION", direction: d })}
      />

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2">
        {(["CE", "PE", "BOTH"] as ActionType[]).map((action) => {
          const Icon =
            action === "BOTH"
              ? ArrowUpDown
              : action === "CE"
                ? isBuy ? TrendingUp : TrendingDown
                : isBuy ? TrendingDown : TrendingUp;

          return (
            <Button
              key={action}
              disabled={acting !== null || !selected}
              onClick={() => execute(action)}
              className={cn(
                "h-9 font-semibold text-sm gap-1.5",
                isBuy
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white",
              )}
            >
              {acting === action ? (
                <>
                  <Zap className="size-3.5 animate-pulse" />
                  Placing…
                </>
              ) : (
                <>
                  <Icon className="size-4" />
                  {action === "BOTH" ? "CE + PE" : action}
                </>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
});
