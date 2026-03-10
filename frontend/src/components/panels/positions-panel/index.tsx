import { useState } from "react";
import { getLotSize } from "@/lib/lot-sizes";
import { exitPosition, placeMarketOrder } from "@/services/trading-api";
import { PositionRow } from "./position-row";
import type { QtyMode } from "./qty-input";
import type { Position } from "@/types";

interface PositionsPanelProps {
  positions: Position[];
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  loading: boolean;
  isLive: boolean;
  load: () => void;
}

export function PositionsPanel({ positions, loading, load }: PositionsPanelProps) {
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
    try {
      await fn();
      await load();
    } catch {
      // errors surface in stats bar via terminal-page
    } finally {
      setActing(null);
    }
  };

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
  const closedPositions = positions.filter((p) => p.quantity === 0);
  const sorted = [...openPositions, ...closedPositions];

  const cols = (
    <tr className="border-b border-border text-muted-foreground">
      <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
      <th className="px-3 py-1.5 text-left font-medium">Product</th>
      <th className="px-3 py-1.5 text-right font-medium">Qty</th>
      <th className="px-3 py-1.5 text-right font-medium">Avg</th>
      <th className="px-3 py-1.5 text-right font-medium">LTP</th>
      <th className="px-3 py-1.5 text-right font-medium">P&amp;L</th>
      <th className="px-3 py-1.5 text-right font-medium">Unrealised</th>
      <th className="px-3 py-1.5 text-right font-medium">Realised</th>
      <th className="px-3 py-1.5 text-right font-medium"></th>
    </tr>
  );

  const renderRow = (p: Position) => (
    <PositionRow
      key={p.instrument_token + p.product}
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
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        {sorted.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No positions
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background z-10">{cols}</thead>
            <tbody>
              {openPositions.map(renderRow)}
              {closedPositions.length > 0 && openPositions.length > 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 bg-muted/20">
                    Closed
                  </td>
                </tr>
              )}
              {closedPositions.map(renderRow)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
