import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useNewRows } from "@/hooks/use-new-rows";
import { toast } from "@/lib/toast";
import { LogOut, LayoutList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { BrokerBadge } from "@/components/ui/broker-badge";
import { getLotSize } from "@/lib/lot-sizes";
import { exitPosition, placeMarketOrder, shiftPosition } from "@/services/trading-api";
import { getShiftOffset, UNDERLYING_KEYS } from "@/lib/shift-config";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { PositionRow } from "./position-row";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import type { QtyMode } from "./qty-input";
import type { Position } from "@/types";

interface PositionsPanelProps {
  positions: Position[];
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  loading: boolean;
  isLive: boolean;
  load: () => void;
  mtmByBroker?: Record<string, number>;
  netDelta?: number;
  thetaPerDay?: number;
  netGamma?: number;
  netVega?: number;
}

const selKey = (p: Position) => `${p.instrumentToken}|${p.product}`;

export function PositionsPanel({ positions, loading, load, mtmByBroker = {}, netDelta, thetaPerDay = 0, netGamma = 0, netVega = 0 }: PositionsPanelProps) {
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

  const handleExit = (token: string, product: string, broker: string) =>
    withActing(token + ":exit", () => exitPosition(token, product, broker));

  const handleAdd = (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => {
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const txn = position.quantity >= 0 ? "Buy" : "Sell";
    return withActing(token + ":add", () => placeMarketOrder(token, qty, txn, product, broker, exchange));
  };

  const handleShift = (
    token: string,
    tradingSymbol: string,
    product: string,
    direction: "up" | "down",
    broker: string,
    exchange: string,
  ) => {
    const lookup = getByInstrumentKey(token, tradingSymbol);
    if (!lookup) return;

    const { contract, index } = lookup;
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    if (qty === 0) return;

    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const strikeGap = getShiftOffset(index);
    const underlyingKey = UNDERLYING_KEYS[index];

    return withActing(token + ":shift-" + direction, () =>
      shiftPosition(broker, {
        instrumentToken: token,
        exchange,
        qty,
        direction,
        product,
        currentStrike: contract.strikePrice,
        strikeGap,
        underlyingKey,
        expiry: contract.expiry,
        instrumentType: contract.instrumentType,
        isShort: position.quantity < 0,
      })
    );
  };

  const handleReduce = (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => {
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const txn = position.quantity >= 0 ? "Sell" : "Buy";
    return withActing(token + ":reduce", () => placeMarketOrder(token, qty, txn, product, broker, exchange));
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
      await Promise.all(toExit.map((p) => exitPosition(p.instrumentToken, p.product, p.broker ?? "upstox")));
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const handleExitByType = (instrumentType: "CE" | "PE") => async () => {
    const toExit = openPositions.filter((p) => {
      const lookup = getByInstrumentKey(p.instrumentToken, p.tradingSymbol);
      return lookup?.contract.instrumentType === instrumentType;
    });
    if (toExit.length === 0) return;
    setActing(`type-${instrumentType}`);
    try {
      await Promise.all(toExit.map((p) => exitPosition(p.instrumentToken, p.product, p.broker ?? "upstox")));
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const selectedCount = allOpenKeys.filter((k) => selected.has(k)).length;

  const thetaEarnedToday = (() => {
    if (!thetaPerDay) return 0;
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const totalMins = ist.getHours() * 60 + ist.getMinutes();
    if (totalMins < 9 * 60 + 15) return 0;
    const elapsed = Math.min(totalMins - (9 * 60 + 15), 375);
    return thetaPerDay * (elapsed / 375);
  })();

  const showGreeks = netDelta !== undefined && openPositions.length > 0 && (netDelta !== 0 || thetaPerDay !== 0);

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
      <th className="px-3 py-1.5 text-right font-medium">B/E</th>
      <th className="px-3 py-1.5">
        <div className="flex items-center justify-end gap-2">
          {/* Portfolio Greeks */}
          {showGreeks && (
            <span className="flex items-center gap-2.5 text-[10px] font-normal">
              <span
                className="flex items-center gap-0.5"
                title={`Net delta — sellers aim for 0. ${Math.abs(netDelta!) > 0.5 ? "High directional exposure." : "Roughly balanced."}`}
              >
                <span className="text-muted-foreground">Δ</span>
                <span className={cn(
                  "font-mono tabular-nums font-medium",
                  Math.abs(netDelta!) <= 0.1 ? "text-green-500" :
                  Math.abs(netDelta!) <= 0.5 ? "text-amber-500" : "text-red-500",
                )}>
                  {netDelta! >= 0 ? "+" : ""}{netDelta!.toFixed(2)}
                </span>
              </span>
              {netGamma !== 0 && (
                <span
                  className="flex items-center gap-0.5"
                  title="Net gamma — sellers want near-zero. Large negative = delta swings wildly."
                >
                  <span className="text-muted-foreground">Γ</span>
                  <span className={cn(
                    "font-mono tabular-nums font-medium",
                    Math.abs(netGamma) <= 0.002 ? "text-green-500" :
                    Math.abs(netGamma) <= 0.01  ? "text-amber-500" : "text-red-500",
                  )}>
                    {netGamma.toFixed(4)}
                  </span>
                </span>
              )}
              <span
                className="flex items-center gap-0.5"
                title={`Theta ₹${Math.round(thetaPerDay)}/day — ₹${Math.round(thetaEarnedToday)} earned so far today.`}
              >
                <span className="text-muted-foreground">Θ</span>
                <span className={cn("font-mono tabular-nums font-medium", thetaPerDay > 0 ? "text-green-500" : "text-red-500")}>
                  {thetaEarnedToday !== 0
                    ? <>{thetaEarnedToday > 0 ? "+" : ""}₹{Math.round(thetaEarnedToday)} <span className="text-muted-foreground/50 font-normal">/ ₹{Math.round(thetaPerDay)}</span></>
                    : <>{thetaPerDay >= 0 ? "+" : ""}₹{Math.round(thetaPerDay)}/d</>
                  }
                </span>
              </span>
              {netVega !== 0 && (
                <span
                  className="flex items-center gap-0.5"
                  title={`Net vega ₹${Math.round(netVega)} — P&L change per 1% IV move. Negative is normal for sellers.`}
                >
                  <span className="text-muted-foreground">V</span>
                  <span className={cn("font-mono tabular-nums font-medium", netVega <= 0 ? "text-green-500" : "text-red-500")}>
                    {netVega >= 0 ? "+" : ""}₹{Math.round(netVega)}
                  </span>
                </span>
              )}
            </span>
          )}

          {showGreeks && <span className="text-muted-foreground/30">|</span>}

          {/* Actions */}
          {selectedCount > 0 ? (
            <div className="flex items-center gap-2">
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
          ) : (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-2 text-[10px] text-red-500 hover:bg-red-500/10 hover:text-red-500"
                disabled={!!acting}
                onClick={handleExitByType("CE")}
              >
                Exit CEs
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-2 text-[10px] text-green-600 hover:bg-green-500/10 hover:text-green-600"
                disabled={!!acting}
                onClick={handleExitByType("PE")}
              >
                Exit PEs
              </Button>
            </div>
          )}
        </div>
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
      onAdd={() => handleAdd(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange)}
      onReduce={() => handleReduce(p.instrumentToken, p.tradingSymbol, p.product, p.broker ?? "upstox", p.exchange)}
      onExit={() => handleExit(p.instrumentToken, p.product, p.broker ?? "upstox")}
      onShiftUp={() => handleShift(p.instrumentToken, p.tradingSymbol, p.product, "up", p.broker ?? "upstox", p.exchange ?? "")}
      onShiftDown={() => handleShift(p.instrumentToken, p.tradingSymbol, p.product, "down", p.broker ?? "upstox", p.exchange ?? "")}
    />
  );

  return (
    <div className="flex h-full flex-col">
      {showFilter && (
        <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/40 bg-muted/20 px-3">
          <button
            onClick={() => setBrokerFilter(null)}
            className={cn(
              "cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              brokerFilter === null
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {brokersInPositions.map((bId) => {
            const pnl = mtmByBroker[bId];
            return (
              <button
                key={bId}
                onClick={() => setBrokerFilter(brokerFilter === bId ? null : bId)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  brokerFilter === bId
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BrokerBadge brokerId={bId} size={12} />
                {bId.charAt(0).toUpperCase() + bId.slice(1)}
                {pnl !== undefined && (
                  <span className={cn("font-mono tabular-nums", pnl >= 0 ? "text-green-500" : "text-red-500")}>
                    {pnl >= 0 ? "+" : "-"}₹{Math.abs(pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {loading && sorted.length === 0 ? (
          <table className="w-full text-xs">
            <tbody>
              {[0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="px-3 py-2"><Skeleton className="h-3.5 w-3.5" /></td>
                  <td className="px-3 py-2">
                    <Skeleton className="mb-1 h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-20" />
                  </td>
                  <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-3.5 w-8" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-3.5 w-16" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-3.5 w-14" /></td>
                  <td className="px-3 py-2"><Skeleton className="ml-auto h-3.5 w-20" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : sorted.length === 0 && !loading ? (
          <EmptyState icon={LayoutList} message="No positions" />
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted/20 backdrop-blur-sm">{cols}</thead>
            <tbody>
              {openPositions.map(renderRow)}
              {closedPositions.length > 0 && openPositions.length > 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 bg-muted/20">
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
