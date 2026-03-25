import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useNewRows } from "@/hooks/use-new-rows";
import { toast } from "sonner";
import { LogOut, LayoutList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { BrokerBadge } from "@/components/ui/broker-badge";
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

const selKey = (p: Position) => `${p.instrumentToken}|${p.product}`;

export function PositionsPanel({ positions, loading, load }: PositionsPanelProps) {
  const [acting, setActing] = useState<string | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [qtyMode, setQtyMode] = useState<QtyMode>("qty");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [brokerFilter, setBrokerFilter] = useState<string | null>(null);

  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);

  const setQty = (token: string, val: string) =>
    setQtys((prev) => ({ ...prev, [token]: val }));

  const toggleMode = () => {
    const newMode: QtyMode = qtyMode === "qty" ? "lot" : "qty";
    setQtys((prev) => {
      const next: Record<string, string> = {};
      for (const p of positions) {
        const lot = getLotSize(p.tradingSymbol);
        const raw = parseInt(prev[p.instrumentToken] ?? "", 10);
        if (isNaN(raw) || raw <= 0) { next[p.instrumentToken] = ""; continue; }
        next[p.instrumentToken] =
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
    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const txn = position.quantity >= 0 ? "Buy" : "Sell";
    return withActing(token + ":add", () => placeMarketOrder(token, qty, txn, product));
  };

  const handleShift = (
    token: string,
    tradingSymbol: string,
    product: string,
    direction: "up" | "down",
  ) => {
    const lookup = getByInstrumentKey(token);
    if (!lookup) return;

    const { contract, index } = lookup;
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    if (qty === 0) return;

    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const closeTxn = position.quantity < 0 ? "Buy" : "Sell";
    const openTxn  = position.quantity < 0 ? "Sell" : "Buy";
    const offset = getShiftOffset(index);
    const targetPremium = position.ltp + (direction === "up" ? offset : -offset);
    const priceSearchMode = direction === "up" ? "GreaterThan" : "LessThan";
    const underlyingKey = UNDERLYING_KEYS[index];

    return withActing(token + ":shift-" + direction, async () => {
      await placeMarketOrder(token, qty, closeTxn, product);
      await placeOrderByOptionPrice({
        underlyingKey,
        expiryDate: contract.expiry,
        optionType: contract.instrumentType,
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
    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const txn = position.quantity >= 0 ? "Sell" : "Buy";
    return withActing(token + ":reduce", () => placeMarketOrder(token, qty, txn, product));
  };

  const posKey = useCallback((p: Position) => p.instrumentToken + p.product, []);
  const newPositionKeys = useNewRows(positions, posKey);

  // Unique brokers present in positions — drives filter pills
  const brokersInPositions = Array.from(new Set(positions.map((p) => p.broker ?? "upstox")));
  const showFilter = brokersInPositions.length > 1;

  const filtered = brokerFilter ? positions.filter((p) => (p.broker ?? "upstox") === brokerFilter) : positions;
  const openPositions = filtered.filter((p) => p.quantity !== 0);
  const closedPositions = filtered.filter((p) => p.quantity === 0);
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
      await Promise.all(toExit.map((p) => exitPosition(p.instrumentToken, p.product)));
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
      key={p.instrumentToken + p.product}
      position={p}
      isNew={newPositionKeys.has(p.instrumentToken + p.product)}
      qtyValue={qtys[p.instrumentToken] ?? ""}
      qtyMode={qtyMode}
      acting={acting}
      selected={selected.has(selKey(p))}
      onToggleSelect={() => toggleSelect(p)}
      onQtyChange={(v) => setQty(p.instrumentToken, v)}
      onToggleMode={toggleMode}
      onAdd={() => handleAdd(p.instrumentToken, p.tradingSymbol, p.product)}
      onReduce={() => handleReduce(p.instrumentToken, p.tradingSymbol, p.product)}
      onExit={() => handleExit(p.instrumentToken, p.product)}
      onShiftUp={() => handleShift(p.instrumentToken, p.tradingSymbol, p.product, "up")}
      onShiftDown={() => handleShift(p.instrumentToken, p.tradingSymbol, p.product, "down")}
    />
  );

  return (
    <div className="flex h-full flex-col">
      {showFilter && (
        <div className="flex shrink-0 items-center gap-1 border-b border-border/40 bg-muted/20 px-3 py-1.5">
          <button
            onClick={() => setBrokerFilter(null)}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              brokerFilter === null
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {brokersInPositions.map((bId) => (
            <button
              key={bId}
              onClick={() => setBrokerFilter(brokerFilter === bId ? null : bId)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                brokerFilter === bId
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <BrokerBadge brokerId={bId} size={12} />
              {bId.charAt(0).toUpperCase() + bId.slice(1)}
            </button>
          ))}
        </div>
      )}
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
