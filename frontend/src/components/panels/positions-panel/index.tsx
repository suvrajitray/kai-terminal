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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-default items-center gap-0.5">
                    <span className="text-muted-foreground">Δ</span>
                    <span className={cn(
                      "font-mono tabular-nums font-medium",
                      Math.abs(netDelta!) <= 0.1 ? "text-green-500" :
                      Math.abs(netDelta!) <= 0.5 ? "text-amber-500" : "text-red-500",
                    )}>
                      {netDelta! >= 0 ? "+" : ""}{netDelta!.toFixed(2)}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] space-y-1 text-xs">
                  <p className="font-semibold">Net Delta (Δ)</p>
                  <p className="text-muted-foreground">
                    How much your portfolio moves per ₹1 rise in the underlying. <span className="text-foreground">+{netDelta!.toFixed(1)}</span> means you gain ₹{netDelta!.toFixed(1)} for every ₹1 rise.
                  </p>
                  <p className={cn("font-medium",
                    Math.abs(netDelta!) <= 0.1 ? "text-green-400" :
                    Math.abs(netDelta!) <= 0.5 ? "text-amber-400" : "text-red-400"
                  )}>
                    {Math.abs(netDelta!) <= 0.1
                      ? "Balanced — ideal for sellers."
                      : Math.abs(netDelta!) <= 0.5
                      ? "Slight directional bias — watch it."
                      : netDelta! > 0
                      ? "Bullish skew — consider selling CEs or buying PEs to hedge."
                      : "Bearish skew — consider selling PEs or buying CEs to hedge."}
                  </p>
                </TooltipContent>
              </Tooltip>

              {netGamma !== 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-default items-center gap-0.5">
                      <span className="text-muted-foreground">Γ</span>
                      <span className={cn(
                        "font-mono tabular-nums font-medium",
                        Math.abs(netGamma) <= 0.002 ? "text-green-500" :
                        Math.abs(netGamma) <= 0.01  ? "text-amber-500" : "text-red-500",
                      )}>
                        {netGamma.toFixed(4)}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px] space-y-1 text-xs">
                    <p className="font-semibold">Net Gamma (Γ)</p>
                    <p className="text-muted-foreground">
                      How fast your delta changes per ₹1 move. A delta of {netDelta!.toFixed(1)} with gamma {netGamma.toFixed(4)} means after a ₹10 move, delta shifts by ~{(netGamma * 10).toFixed(2)}.
                    </p>
                    <p className={cn("font-medium",
                      Math.abs(netGamma) <= 0.002 ? "text-green-400" :
                      Math.abs(netGamma) <= 0.01  ? "text-amber-400" : "text-red-400"
                    )}>
                      {netGamma < 0
                        ? Math.abs(netGamma) > 0.01
                          ? "High negative gamma — big moves hurt you, especially near expiry."
                          : "Moderate negative gamma — normal for short options."
                        : "Positive gamma — you benefit from large moves (long options)."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-default items-center gap-0.5">
                    <span className="text-muted-foreground">Θ</span>
                    <span className={cn("font-mono tabular-nums font-medium", thetaPerDay > 0 ? "text-green-500" : "text-red-500")}>
                      {thetaEarnedToday !== 0
                        ? <>{thetaEarnedToday > 0 ? "+" : ""}₹{Math.round(thetaEarnedToday)} <span className="text-muted-foreground/50 font-normal">/ ₹{Math.round(thetaPerDay)}</span></>
                        : <>{thetaPerDay >= 0 ? "+" : ""}₹{Math.round(thetaPerDay)}/d</>
                      }
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] space-y-1 text-xs">
                  <p className="font-semibold">Net Theta (Θ) — Time Decay</p>
                  <p className="text-muted-foreground">
                    Premium your portfolio earns (or loses) per day from time decay alone.
                    {thetaEarnedToday !== 0 && <> Today so far: <span className="text-foreground">₹{Math.round(thetaEarnedToday)}</span> out of a ₹{Math.round(thetaPerDay)}/day total.</>}
                  </p>
                  <p className={cn("font-medium", thetaPerDay > 0 ? "text-green-400" : "text-red-400")}>
                    {thetaPerDay > 0
                      ? "Positive theta — time works in your favour (short options)."
                      : "Negative theta — you're paying decay (long options)."}
                  </p>
                </TooltipContent>
              </Tooltip>

              {netVega !== 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-default items-center gap-0.5">
                      <span className="text-muted-foreground">V</span>
                      <span className={cn("font-mono tabular-nums font-medium", netVega <= 0 ? "text-green-500" : "text-red-500")}>
                        {netVega >= 0 ? "+" : ""}₹{Math.round(netVega)}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px] space-y-1 text-xs">
                    <p className="font-semibold">Net Vega (V) — IV Sensitivity</p>
                    <p className="text-muted-foreground">
                      P&L change for every 1% rise in implied volatility. If IV rises 1%, your portfolio changes by <span className="text-foreground">₹{Math.round(netVega)}</span>.
                    </p>
                    <p className={cn("font-medium", netVega <= 0 ? "text-green-400" : "text-red-400")}>
                      {netVega < 0
                        ? "Negative vega — you profit when IV falls (normal for sellers). A volatility crush is your friend."
                        : "Positive vega — you profit when IV rises (long options / net buyer)."}
                    </p>
                  </TooltipContent>
                </Tooltip>
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
