import { useEffect, useState, useCallback } from "react";
import { RefreshCw, LogOut, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchPositions, exitAllPositions, exitPosition } from "@/services/trading-api";
import type { Position } from "@/types";

interface PositionsPanelProps {
  expanded: boolean;
  onToggle: () => void;
}

const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 });

function PnlCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        value > 0 ? "text-green-500" : value < 0 ? "text-red-500" : "text-muted-foreground",
      )}
    >
      {value >= 0 ? "+" : ""}₹{INR.format(value)}
    </span>
  );
}

export function PositionsPanel({ expanded, onToggle }: PositionsPanelProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [exiting,   setExiting]   = useState<string | null>(null);

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

  useEffect(() => { load(); }, [load]);

  const handleExitAll = async () => {
    setExiting("all");
    try { await exitAllPositions(); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setExiting(null); }
  };

  const handleExit = async (token: string) => {
    setExiting(token);
    try { await exitPosition(token); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setExiting(null); }
  };

  const openPositions = positions.filter((p) => p.quantity !== 0);
  const totalPnl      = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="flex h-full flex-col">

      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-3">
        <span className="text-xs font-semibold tracking-tight">Positions</span>

        {positions.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground">
              {openPositions.length} open · {positions.length - openPositions.length} closed
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
              disabled={exiting === "all"}
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
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
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
                  <th className="px-3 py-1.5 text-right font-medium">P&amp;L</th>
                  <th className="px-3 py-1.5 text-right font-medium">Unrealised</th>
                  <th className="px-3 py-1.5 text-right font-medium">Realised</th>
                  <th className="px-3 py-1.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr
                    key={p.instrument_token}
                    className={cn(
                      "border-b border-border/40 transition-colors hover:bg-muted/30",
                      p.quantity === 0 && "opacity-50",
                    )}
                  >
                    <td className="px-3 py-1.5">
                      <span className="font-medium">{p.trading_symbol}</span>
                      <span className="ml-1.5 text-muted-foreground">{p.exchange} · {p.product}</span>
                    </td>
                    <td className={cn(
                      "px-3 py-1.5 text-right tabular-nums font-semibold",
                      p.quantity < 0 ? "text-red-500" : "text-green-500",
                    )}>
                      {p.quantity > 0 ? "+" : ""}{p.quantity}
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
                    <td className="px-3 py-1.5 text-right">
                      {p.quantity !== 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleExit(p.instrument_token)}
                          disabled={exiting === p.instrument_token}
                        >
                          Exit
                        </Button>
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
