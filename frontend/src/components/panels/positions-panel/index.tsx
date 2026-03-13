import { useState } from "react";
import { toast } from "sonner";
import { LogOut, LayoutList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getLotSize } from "@/lib/lot-sizes";
import { exitPosition, placeMarketOrder, placeOrderByOptionPrice } from "@/services/trading-api";
import { getShiftOffset, UNDERLYING_KEYS } from "@/lib/shift-config";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { PositionRow } from "./position-row";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { QtyMode } from "./qty-input";
import type { Position } from "@/types";

interface PositionsPanelProps {
  positions: Position[];
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  loading: boolean;
  isLive: boolean;
  load: () => void;
}

const selKey = (p: Position) => `${p.instrument_token}|${p.product}`;

export function PositionsPanel({ positions, loading, load }: PositionsPanelProps) {
  const [acting, setActing] = useState<string | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [qtyMode, setQtyMode] = useState<QtyMode>("qty");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);

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
    } catch (e) {
      toast.error((e as Error).message);
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

  const handleShift = (
    token: string,
    tradingSymbol: string,
    product: string,
    direction: "up" | "down",
  ) => {
    const contract = getByInstrumentKey(token);
    if (!contract) return;

    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    if (qty === 0) return;

    const position = positions.find((p) => p.instrument_token === token && p.product === product)!;
    const closeTxn = position.quantity < 0 ? "Buy" : "Sell";
    const openTxn  = position.quantity < 0 ? "Sell" : "Buy";
    const underlying = Object.keys(UNDERLYING_KEYS).find((k) => UNDERLYING_KEYS[k] === contract.underlying_key) ?? contract.underlying_symbol;
    const offset = getShiftOffset(underlying);
    const targetPremium = position.last_price + (direction === "up" ? offset : -offset);
    const priceSearchMode = direction === "up" ? "GreaterThan" : "LessThan";

    return withActing(token + ":shift-" + direction, async () => {
      await placeMarketOrder(token, qty, closeTxn, product);
      await placeOrderByOptionPrice({
        underlyingKey: contract.underlying_key,
        expiryDate: contract.expiry,
        optionType: contract.instrument_type,
        targetPremium,
        priceSearchMode,
        quantity: qty,
        transactionType: openTxn,
        product,
      });
    });
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

  // Selection helpers
  const allOpenKeys = openPositions.map(selKey);
  const allSelected = allOpenKeys.length > 0 && allOpenKeys.every((k) => selected.has(k));
  const someSelected = allOpenKeys.some((k) => selected.has(k));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allOpenKeys));
    }
  };

  const toggleSelect = (p: Position) => {
    if (p.quantity === 0) return;
    const k = selKey(p);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const handleExitSelected = async () => {
    const toExit = openPositions.filter((p) => selected.has(selKey(p)));
    setActing("selected");
    try {
      await Promise.all(toExit.map((p) => exitPosition(p.instrument_token, p.product)));
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const selectedCount = allOpenKeys.filter((k) => selected.has(k)).length;

  const cols = (
    <tr className="border-b border-border text-muted-foreground h-9">
      <th className="pl-3 py-1.5 w-7">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={toggleSelectAll}
        />
      </th>
      <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
      <th className="px-3 py-1.5 text-left font-medium">Product</th>
      <th className="px-3 py-1.5 text-right font-medium">Qty</th>
      <th className="px-3 py-1.5 text-right font-medium">Avg</th>
      <th className="px-3 py-1.5 text-right font-medium">LTP</th>
      <th className="px-3 py-1.5 text-right font-medium">P&amp;L</th>
      <th className="px-3 py-1.5 text-right font-medium">Unrealised</th>
      <th className="px-3 py-1.5 text-right font-medium">Realised</th>
      <th className="px-3 py-1.5 text-right">
        {selectedCount > 0 && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px] text-muted-foreground">{selectedCount} selected</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-5 px-2 text-[10px]"
              disabled={acting === "selected"}
              onClick={handleExitSelected}
            >
              <LogOut className="mr-1 size-2.5" />
              {acting === "selected" ? "Exiting…" : `Exit ${selectedCount}`}
            </Button>
          </div>
        )}
      </th>
    </tr>
  );

  const renderRow = (p: Position) => (
    <PositionRow
      key={p.instrument_token + p.product}
      position={p}
      qtyValue={qtys[p.instrument_token] ?? ""}
      qtyMode={qtyMode}
      acting={acting}
      selected={selected.has(selKey(p))}
      onToggleSelect={() => toggleSelect(p)}
      onQtyChange={(v) => setQty(p.instrument_token, v)}
      onToggleMode={toggleMode}
      onAdd={() => handleAdd(p.instrument_token, p.trading_symbol, p.product)}
      onReduce={() => handleReduce(p.instrument_token, p.trading_symbol, p.product)}
      onExit={() => handleExit(p.instrument_token, p.product)}
      onShiftUp={() => handleShift(p.instrument_token, p.trading_symbol, p.product, "up")}
      onShiftDown={() => handleShift(p.instrument_token, p.trading_symbol, p.product, "down")}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        {sorted.length === 0 && !loading ? (
          <EmptyState icon={LayoutList} message="No positions" />
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background z-10">{cols}</thead>
            <tbody>
              {openPositions.map(renderRow)}
              {closedPositions.length > 0 && openPositions.length > 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 bg-muted/20">
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
