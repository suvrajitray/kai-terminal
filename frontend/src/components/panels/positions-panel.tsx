import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  LogOut,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLotSize } from "@/lib/lot-sizes";
import {
  fetchPositions,
  exitAllPositions,
  exitPosition,
  placeMarketOrder,
} from "@/services/trading-api";
import type { Position } from "@/types";

interface PositionsPanelProps {
  expanded: boolean;
  onToggle: () => void;
}

type QtyMode = "qty" | "lot";

const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 });

function PnlCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        value > 0
          ? "text-green-500"
          : value < 0
            ? "text-red-500"
            : "text-muted-foreground",
      )}
    >
      {value >= 0 ? "+" : ""}₹{INR.format(value)}
    </span>
  );
}

interface QtyInputProps {
  value: string;
  mode: QtyMode;
  multiplier: number;
  onChange: (v: string) => void;
  onToggleMode: () => void;
}

function QtyInput({
  value,
  mode,
  multiplier,
  onChange,
  onToggleMode,
}: QtyInputProps) {
  const lot = Math.max(multiplier, 1);
  const step = mode === "qty" ? lot : 1;
  const num = parseInt(value, 10);

  const handleBlur = () => {
    if (value === "") return;
    if (mode === "qty" && lot > 1) {
      const raw = num || lot;
      const snapped = Math.max(lot, Math.floor(raw / lot) * lot);
      if (snapped !== raw) onChange(String(snapped));
    }
  };

  const handleDecrement = () => {
    const cur = isNaN(num) ? 0 : num;
    const next = Math.max(0, cur - step);
    onChange(next === 0 ? "" : String(next));
  };

  const handleIncrement = () => {
    const cur = isNaN(num) ? 0 : num;
    const next = cur + step;
    onChange(String(next));
  };

  // Hint always rendered (non-breaking space) so row height never shifts
  const hintText =
    value === ""
      ? "\u00a0"
      : mode === "lot"
        ? `${num * lot} qty.`
        : lot > 1
          ? `${Math.floor(num / lot)} lot`
          : "\u00a0";

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-[10px] leading-none text-muted-foreground">
        {mode === "qty" ? "Qty." : "Lots"}
      </span>
      <div className="flex items-stretch overflow-hidden rounded border border-border bg-background focus-within:ring-1 focus-within:ring-ring">
        {/* Mode toggle — LEFT */}
        <button
          type="button"
          onClick={onToggleMode}
          title={mode === "qty" ? "Switch to lots" : "Switch to qty"}
          className="flex items-center border-r border-border px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {mode === "qty" ? (
            <Layers className="size-3" />
          ) : (
            <Box className="size-3" />
          )}
        </button>
        <input
          type="number"
          min="0"
          value={value}
          placeholder=""
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          className="w-12 bg-transparent py-1 pl-1.5 pr-0.5 text-right text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:outline-none"
        />
        {/* Stepper buttons — RIGHT */}
        <div className="flex flex-col border-l border-border">
          <button
            type="button"
            onClick={handleIncrement}
            className="flex flex-1 items-center justify-center border-b border-border px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={`+${step}`}
          >
            <ChevronUp className="size-2.5" />
          </button>
          <button
            type="button"
            onClick={handleDecrement}
            className="flex flex-1 items-center justify-center px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={`-${step}`}
          >
            <ChevronDown className="size-2.5" />
          </button>
        </div>
      </div>
      {/* Fixed-height hint row — prevents row flicker */}
      <span className="text-[10px] leading-none text-muted-foreground">
        {hintText}
      </span>
    </div>
  );
}

export function PositionsPanel({ expanded, onToggle }: PositionsPanelProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [qtyMode, setQtyMode] = useState<QtyMode>("qty");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPositions(await fetchPositions());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Toggle mode globally, converting all existing values ───────────────
  const toggleMode = () => {
    const newMode: QtyMode = qtyMode === "qty" ? "lot" : "qty";
    setQtys((prev) => {
      const next: Record<string, string> = {};
      for (const p of positions) {
        const lot = getLotSize(p.trading_symbol);
        const raw = parseInt(prev[p.instrument_token] ?? "", 10);
        if (isNaN(raw) || raw <= 0) {
          next[p.instrument_token] = "";
          continue;
        }
        next[p.instrument_token] =
          newMode === "lot"
            ? String(Math.max(1, Math.round(raw / lot)))
            : String(raw * lot);
      }
      return next;
    });
    setQtyMode(newMode);
  };

  // ── Resolve actual qty to send to the broker ───────────────────────────
  const actualQty = (token: string, tradingSymbol: string): number => {
    const lot = getLotSize(tradingSymbol);
    const val = parseInt(qtys[token] ?? "", 10);
    if (isNaN(val) || val <= 0) return 0;
    return qtyMode === "lot" ? val * lot : val;
  };

  const setQty = (token: string, val: string) =>
    setQtys((prev) => ({ ...prev, [token]: val }));

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleExitAll = async () => {
    setActing("all");
    setError(null);
    try {
      await exitAllPositions();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const handleExit = async (token: string) => {
    setActing(token + ":exit");
    setError(null);
    try {
      await exitPosition(token);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const handleAdd = async (p: Position) => {
    const qty = actualQty(p.instrument_token, p.trading_symbol);
    const txn = p.quantity >= 0 ? "Buy" : "Sell";
    setActing(p.instrument_token + ":add");
    setError(null);
    try {
      await placeMarketOrder(p.instrument_token, qty, txn);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const handleReduce = async (p: Position) => {
    const qty = actualQty(p.instrument_token, p.trading_symbol);
    const txn = p.quantity >= 0 ? "Sell" : "Buy";
    setActing(p.instrument_token + ":reduce");
    setError(null);
    try {
      await placeMarketOrder(p.instrument_token, qty, txn);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const openPositions = positions.filter((p) => p.quantity !== 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="flex h-full flex-col">
      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-3">
        <span className="text-xs font-semibold tracking-tight">Positions</span>

        {positions.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground">
              {openPositions.length} open ·{" "}
              {positions.length - openPositions.length} closed
            </span>
            <span className="text-xs">
              MTM: <PnlCell value={totalPnl} />
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          {error && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" />
              {error}
            </span>
          )}
          {openPositions.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
              onClick={handleExitAll}
              disabled={acting === "all"}
            >
              <LogOut className="mr-1 size-3" />
              Exit All
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            onClick={load}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            onClick={onToggle}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="flex-1 overflow-auto">
          {positions.length === 0 && !loading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No positions
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
                  <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-1.5 text-right font-medium">Avg</th>
                  <th className="px-3 py-1.5 text-right font-medium">LTP</th>
                  <th className="px-3 py-1.5 text-right font-medium">
                    P&amp;L
                  </th>
                  <th className="px-3 py-1.5 text-right font-medium">
                    Unrealised
                  </th>
                  <th className="px-3 py-1.5 text-right font-medium">
                    Realised
                  </th>
                  <th className="px-3 py-1.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr
                    key={p.instrument_token}
                    className={cn(
                      "border-b border-border/40 transition-colors hover:bg-muted/30 align-middle",
                      p.quantity === 0 && "opacity-50",
                    )}
                  >
                    <td className="px-3 py-1.5">
                      <span className="font-medium">{p.trading_symbol}</span>
                      <span className="ml-1.5 text-muted-foreground">
                        {p.exchange} · {p.product}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-1.5 text-right tabular-nums font-semibold",
                        p.quantity < 0 ? "text-red-500" : "text-green-500",
                      )}
                    >
                      {p.quantity > 0 ? "+" : ""}
                      {p.quantity}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      ₹{INR.format(p.average_price)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      ₹{INR.format(p.last_price)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <PnlCell value={p.pnl} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <PnlCell value={p.unrealised} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <PnlCell value={p.realised} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {p.quantity !== 0 && (
                        <div className="flex items-center justify-end gap-1">
                          <QtyInput
                            value={qtys[p.instrument_token] ?? ""}
                            mode={qtyMode}
                            multiplier={getLotSize(p.trading_symbol)}
                            onChange={(v) => setQty(p.instrument_token, v)}
                            onToggleMode={toggleMode}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-green-500 hover:bg-green-500/10 hover:text-green-400"
                            onClick={() => handleAdd(p)}
                            disabled={
                              !!acting ||
                              actualQty(
                                p.instrument_token,
                                p.trading_symbol,
                              ) === 0
                            }
                            title="Add to position"
                          >
                            +
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                            onClick={() => handleReduce(p)}
                            disabled={
                              !!acting ||
                              actualQty(
                                p.instrument_token,
                                p.trading_symbol,
                              ) === 0
                            }
                            title="Reduce position"
                          >
                            −
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleExit(p.instrument_token)}
                            disabled={!!acting}
                          >
                            Exit
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
