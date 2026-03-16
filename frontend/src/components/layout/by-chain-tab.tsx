import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Zap, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { fetchOptionChain, placeMarketOrder, type MarginInstrument } from "@/services/trading-api";
import { useDirectMarginEstimate } from "./use-margin-estimate";
import type { OptionChainEntry } from "@/types";

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

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

  const sorted = [...chain].sort((a, b) => a.strike_price - b.strike_price);

  const atmEntry = sorted.reduce((best, e) =>
    Math.abs(e.strike_price - spotPrice) < Math.abs(best.strike_price - spotPrice) ? e : best,
  );
  const atmStrike = atmEntry.strike_price;
  const atmIdx    = sorted.findIndex((e) => e.strike_price === atmStrike);

  if (mode === "straddle") {
    // Each chain entry → one row. CE and PE at the SAME strike.
    // DIFF = strike − ATM  (negative = below ATM, 0 = ATM, positive = above ATM)
    const rows = sorted.map((entry) => ({
      diff:      entry.strike_price - atmStrike,
      ceStrike:  entry.strike_price,
      ceLtp:     entry.call_options?.market_data?.ltp,
      ceKey:     entry.call_options?.instrument_key,
      peStrike:  entry.strike_price,
      peLtp:     entry.put_options?.market_data?.ltp,
      peKey:     entry.put_options?.instrument_key,
    }));
    return { rows, atmStrike };
  } else {
    // Strangle: pair CE at ATM+N with PE at ATM−N (symmetric OTM pairs).
    // DIFF starts at the first strike step (always positive).
    const maxPairs = Math.min(atmIdx, sorted.length - atmIdx - 1);
    const rows: StraddleRow[] = [];

    for (let i = 1; i <= maxPairs; i++) {
      const ceEntry = sorted[atmIdx + i]; // OTM CE (above ATM)
      const peEntry = sorted[atmIdx - i]; // OTM PE (below ATM)
      rows.push({
        diff:     ceEntry.strike_price - atmStrike,
        ceStrike: ceEntry.strike_price,
        ceLtp:    ceEntry.call_options?.market_data?.ltp,
        ceKey:    ceEntry.call_options?.instrument_key,
        peStrike: peEntry.strike_price,
        peLtp:    peEntry.put_options?.market_data?.ltp,
        peKey:    peEntry.put_options?.instrument_key,
      });
    }
    return { rows, atmStrike };
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  underlying: string;
  expiry: string;
  product: "I" | "D";
  quantity: number;
  isActive: boolean;
}

export function ByChainTab({ underlying, expiry, product, quantity, isActive }: Props) {
  const [chain, setChain]               = useState<OptionChainEntry[]>([]);
  const [loading, setLoading]           = useState(false);
  const [mode, setMode]                 = useState<StrategyMode>("strangle");
  const [selectedDiff, setSelectedDiff] = useState<number | null>(null);
  const [direction, setDirection]       = useState<Direction>("Sell");
  const [acting, setActing]             = useState<ActionType | null>(null);

  const atmRowRef  = useRef<HTMLTableRowElement | null>(null);
  const scrollRef  = useRef<HTMLDivElement | null>(null);

  const underlyingKey = UNDERLYING_KEYS[underlying];
  const spotPrice     = chain[0]?.underlying_spot_price ?? 0;

  const { rows, atmStrike } = buildRows(chain, spotPrice, mode);

  // Reset selection when mode or chain changes
  useEffect(() => { setSelectedDiff(null); }, [mode, chain]);

  async function loadChain() {
    if (!expiry || !underlyingKey) return;
    setLoading(true);
    try {
      const data = await fetchOptionChain(underlyingKey, expiry);
      setChain(data);
    } catch {
      toast.error("Failed to load option chain");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isActive && expiry) loadChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [underlying, expiry, isActive]);

  // Scroll ATM / first row into view after chain loads
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

  // Build margin instruments for the selected row (both legs)
  const marginInstruments: MarginInstrument[] | null = selected && selected.ceKey && selected.peKey
    ? [
        { instrumentToken: selected.ceKey, quantity, product: product === "D" ? "D" : "I", transactionType: isBuy ? "BUY" : "SELL" },
        { instrumentToken: selected.peKey, quantity, product: product === "D" ? "D" : "I", transactionType: isBuy ? "BUY" : "SELL" },
      ]
    : null;

  const { margin, loading: marginLoading } = useDirectMarginEstimate(marginInstruments);

  async function execute(action: ActionType) {
    if (!selected) { toast.error("Select a row first"); return; }

    const { ceKey, peKey } = selected;

    if ((action === "CE" || action === "BOTH") && !ceKey) {
      toast.error("CE instrument not available"); return;
    }
    if ((action === "PE" || action === "BOTH") && !peKey) {
      toast.error("PE instrument not available"); return;
    }

    const orders: Promise<void>[] = [];
    if (action === "CE"   || action === "BOTH") orders.push(placeMarketOrder(ceKey!, quantity, direction, product));
    if (action === "PE"   || action === "BOTH") orders.push(placeMarketOrder(peKey!, quantity, direction, product));

    setActing(action);
    try {
      await Promise.all(orders);
      toast.success("Order placed");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }

  const fmt = (n?: number) => (n != null ? n.toFixed(2) : "—");

  // For straddle, ATM is DIFF=0. For strangle, scroll to first row (smallest strangle).
  const scrollTargetDiff = mode === "straddle" ? 0 : rows[0]?.diff ?? 0;

  return (
    <div className="space-y-4">
      {/* Strategy toggle + ATM info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/20 p-1">
          {(["strangle", "straddle"] as StrategyMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
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

        <div className="flex items-center gap-3 text-[11px]">
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
              <th className="py-2 w-20 text-center font-semibold uppercase tracking-wider text-sky-400/80">
                Call
              </th>
              <th className="py-2 w-20 text-center font-semibold uppercase tracking-wider text-sky-400/60">
                LTP
              </th>
              <th className="py-2 w-20 text-center font-semibold uppercase tracking-wider text-red-400/80">
                Put
              </th>
              <th className="py-2 w-20 text-center font-semibold uppercase tracking-wider text-red-400/60">
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
                      onClick={() => setSelectedDiff(isSelected ? null : row.diff)}
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
                              ? "text-amber-400"
                              : isSelected
                                ? "text-primary"
                                : "text-muted-foreground/70",
                          )}
                        >
                          {row.diff === 0 ? (
                            <span className="flex items-center gap-1">
                              <span className="inline-block size-1.5 rounded-full bg-amber-400" />
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
                            row.diff === 0 ? "text-amber-400" : "text-sky-400/90",
                          )}
                        >
                          {row.ceStrike}
                        </span>
                      </td>

                      {/* CE LTP */}
                      <td className="py-2.5 w-20 text-center tabular-nums font-mono text-[12px] text-sky-300">
                        {fmt(row.ceLtp)}
                      </td>

                      {/* PE Strike */}
                      <td className="py-2.5 w-20 text-center">
                        <span
                          className={cn(
                            "text-xs font-bold tabular-nums",
                            row.diff === 0 ? "text-amber-400" : "text-red-400/90",
                          )}
                        >
                          {row.peStrike}
                        </span>
                      </td>

                      {/* PE LTP */}
                      <td className="py-2.5 w-20 text-center tabular-nums font-mono text-[12px] text-red-300">
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
              <span className="text-sky-400 font-bold tabular-nums">CE {selected.ceStrike}</span>
              <span className="text-border/50">+</span>
              <span className="text-red-400 font-bold tabular-nums">PE {selected.peStrike}</span>
            </>
          )}
          <span className="text-border/50 mx-0.5">·</span>
          <span className="text-sky-400 tabular-nums">{fmt(selected.ceLtp)}</span>
          <span className="text-muted-foreground/50">+</span>
          <span className="text-red-400 tabular-nums">{fmt(selected.peLtp)}</span>
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

      {/* Buy / Sell toggle */}
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 p-1">
        {(["Buy", "Sell"] as Direction[]).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            className={cn(
              "flex-1 rounded-md py-2 text-sm font-semibold transition-all",
              direction === d
                ? d === "Buy"
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-red-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Required margin */}
      <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Req. Margin</span>
        {marginLoading ? (
          <span className="animate-pulse text-muted-foreground/60 tabular-nums">Computing…</span>
        ) : margin != null ? (
          <span className="font-semibold tabular-nums">₹{INR.format(margin)}</span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </div>

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
                "h-11 font-semibold text-sm gap-1.5",
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
                  {action === "BOTH" ? "Both" : action}
                </>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
