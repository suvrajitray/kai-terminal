import { useState } from "react";
import { getLotSize } from "@/lib/lot-sizes";
import { exitAllPositions, exitPosition, placeMarketOrder } from "@/services/trading-api";
import { usePositionsFeed } from "./use-positions-feed";
import { PositionsHeader } from "./positions-header";
import { PositionRow } from "./position-row";
import type { QtyMode } from "./qty-input";

interface PositionsPanelProps {
  expanded: boolean;
  onToggle: () => void;
}

export function PositionsPanel({ expanded, onToggle }: PositionsPanelProps) {
  const { positions, loading, isLive, load } = usePositionsFeed();
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [qtyMode, setQtyMode] = useState<QtyMode>("qty");

  const setQty = (token: string, val: string) =>
    setQtys((prev) => ({ ...prev, [token]: val }));

  const toggleMode = () => {
    const newMode: QtyMode = qtyMode === "qty" ? "lot" : "qty";
    setQtys((prev) => {
      const next: Record<string, string> = {};
      for (const p of positions) {
        const lot = getLotSize(p.trading_symbol);
        const raw = parseInt(prev[p.instrument_token] ?? "", 10);
        if (isNaN(raw) || raw <= 0) { next[p.instrument_token] = ""; continue; }
        next[p.instrument_token] =
          newMode === "lot"
            ? String(Math.max(1, Math.round(raw / lot)))
            : String(raw * lot);
      }
      return next;
    });
    setQtyMode(newMode);
  };

  const withActing = async (key: string, fn: () => Promise<void>) => {
    setActing(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const handleExitAll = () => withActing("all", exitAllPositions);

  const handleExit = (token: string, product: string) =>
    withActing(token + ":exit", () => exitPosition(token, product));

  const handleAdd = (token: string, tradingSymbol: string, product: string) => {
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    const position = positions.find((p) => p.instrument_token === token && p.product === product)!;
    const txn = position.quantity >= 0 ? "Buy" : "Sell";
    return withActing(token + ":add", () => placeMarketOrder(token, qty, txn, product));
  };

  const handleReduce = (token: string, tradingSymbol: string, product: string) => {
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    const position = positions.find((p) => p.instrument_token === token && p.product === product)!;
    const txn = position.quantity >= 0 ? "Sell" : "Buy";
    return withActing(token + ":reduce", () => placeMarketOrder(token, qty, txn, product));
  };

  const openPositions = positions.filter((p) => p.quantity !== 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="flex h-full flex-col">
      <PositionsHeader
        positions={positions}
        openCount={openPositions.length}
        totalPnl={totalPnl}
        isLive={isLive}
        loading={loading}
        error={error}
        acting={acting}
        expanded={expanded}
        onToggle={onToggle}
        onRefresh={() => load()}
        onExitAll={handleExitAll}
      />

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
                  <PositionRow
                    key={p.instrument_token}
                    position={p}
                    qtyValue={qtys[p.instrument_token] ?? ""}
                    qtyMode={qtyMode}
                    acting={acting}
                    onQtyChange={(v) => setQty(p.instrument_token, v)}
                    onToggleMode={toggleMode}
                    onAdd={() => handleAdd(p.instrument_token, p.trading_symbol, p.product)}
                    onReduce={() => handleReduce(p.instrument_token, p.trading_symbol, p.product)}
                    onExit={() => handleExit(p.instrument_token, p.product)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
