import { useState, useCallback, useMemo } from "react";
import { useNewRows } from "@/hooks/use-new-rows";
import { toast } from "@/lib/toast";
import { getLotSize } from "@/lib/lot-sizes";
import { exitPosition, placeMarketOrder, shiftPosition } from "@/services/trading-api";
import { getShiftOffset, UNDERLYING_KEYS } from "@/lib/shift-config";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { PositionFilters } from "./filters/position-filters";
import { PositionTable } from "./table/position-table";
import type { QtyMode } from "./qty-input";
import type { Position } from "@/types";

interface PositionsPanelProps {
  positions: Position[];
  loading: boolean;
  load: () => void;
  netDelta?: number;
  thetaPerDay?: number;
  netGamma?: number;
  netVega?: number;
  productFilter: "Intraday" | "Delivery" | null;
  onProductFilterChange: (v: "Intraday" | "Delivery" | null) => void;
}

const selKey = (p: Position) => `${p.instrumentToken}|${p.product}`;

export function PositionsPanel({
  positions,
  loading,
  load,
  netDelta,
  thetaPerDay = 0,
  netGamma = 0,
  netVega = 0,
  productFilter,
  onProductFilterChange,
}: PositionsPanelProps) {
  const [acting, setActing] = useState<string | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [qtyMode, setQtyMode] = useState<QtyMode>("qty");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [brokerFilter, setBrokerFilter] = useState<string | null>(null);

  const getByInstrumentKey = useOptionContractsStore((s) => s.getByInstrumentKey);

  const setQty = useCallback((token: string, val: string) =>
    setQtys((prev) => ({ ...prev, [token]: val })), []);

  const toggleMode = useCallback(() => {
    setQtyMode((prevMode) => {
      const newMode: QtyMode = prevMode === "qty" ? "lot" : "qty";
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
      return newMode;
    });
  }, [positions]);

  const withActing = useCallback(async (key: string, fn: () => Promise<void>) => {
    setActing(key);
    try {
      await fn();
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }, [load]);

  const handleAdd = useCallback((token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => {
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const txn = position.quantity >= 0 ? "Buy" : "Sell";
    return withActing(token + ":add", () => placeMarketOrder(token, qty, txn, product, broker, exchange));
  }, [positions, qtys, qtyMode, withActing]);

  const handleShift = useCallback((
    token: string,
    tradingSymbol: string,
    product: string,
    broker: string,
    exchange: string,
  ) => {
    // direction is curried via onShiftUp/onShiftDown at call site
    return (direction: "up" | "down") => {
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

      return withActing(token + ":shift-" + direction, async () => {
        const result = await shiftPosition(broker, {
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
        });
        if (result.warning) toast.warning(result.warning);
      });
    };
  }, [positions, qtys, qtyMode, getByInstrumentKey, withActing]);

  const handleReduce = useCallback((token: string, tradingSymbol: string, product: string, broker: string, exchange: string) => {
    const lot = getLotSize(tradingSymbol);
    const num = parseInt(qtys[token] ?? "", 10);
    const qty = isNaN(num) || num <= 0 ? 0 : qtyMode === "lot" ? num * lot : num;
    const position = positions.find((p) => p.instrumentToken === token && p.product === product)!;
    const txn = position.quantity >= 0 ? "Sell" : "Buy";
    return withActing(token + ":reduce", () => placeMarketOrder(token, qty, txn, product, broker, exchange));
  }, [positions, qtys, qtyMode, withActing]);

  const posKey = useCallback((p: Position) => p.instrumentToken + p.product, []);
  const newPositionKeys = useNewRows(positions, posKey);

  // Unique brokers present in positions — drives filter pills
  const brokersInPositions = useMemo(
    () => Array.from(new Set(positions.map((p) => p.broker ?? "upstox"))),
    [positions],
  );
  const showBrokerFilter = brokersInPositions.length > 1;

  const productTypesInPositions = useMemo(
    () => Array.from(new Set(positions.map((p) => p.product))),
    [positions],
  );
  const showProductFilter = productTypesInPositions.includes("Intraday") && productTypesInPositions.includes("Delivery");
  const showFilter = showBrokerFilter || showProductFilter;

  const filtered = useMemo(
    () => positions
      .filter((p) => !brokerFilter || (p.broker ?? "upstox") === brokerFilter)
      .filter((p) => !productFilter || p.product === productFilter),
    [positions, brokerFilter, productFilter],
  );

  // MTM scoped to the current product filter — broker pills reflect filtered P&L
  const filteredMtmByBroker = useMemo(
    () => filtered.reduce<Record<string, number>>((acc, p) => {
      const key = p.broker ?? "upstox";
      acc[key] = (acc[key] ?? 0) + p.pnl;
      return acc;
    }, {}),
    [filtered],
  );

  const openPositions = useMemo(() => filtered.filter((p) => p.quantity !== 0), [filtered]);
  const closedPositions = useMemo(() => filtered.filter((p) => p.quantity === 0), [filtered]);

  // Selection helpers
  const allOpenKeys = useMemo(() => openPositions.map(selKey), [openPositions]);
  const allSelected = allOpenKeys.length > 0 && allOpenKeys.every((k) => selected.has(k));
  const someSelected = allOpenKeys.some((k) => selected.has(k));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allOpenKeys));
    }
  }, [allSelected, allOpenKeys]);

  const toggleSelect = useCallback((p: Position) => {
    if (p.quantity === 0) return;
    const k = selKey(p);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
  }, []);

  const handleExitSelected = useCallback(async () => {
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
  }, [openPositions, selected, load]);

  const handleExitByType = useCallback((instrumentType: "CE" | "PE") => async () => {
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
  }, [openPositions, getByInstrumentKey, load]);

  const selectedCount = allOpenKeys.filter((k) => selected.has(k)).length;

  const thetaEarnedToday = useMemo(() => {
    if (!thetaPerDay) return 0;
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const totalMins = ist.getHours() * 60 + ist.getMinutes();
    if (totalMins < 9 * 60 + 15) return 0;
    const elapsed = Math.min(totalMins - (9 * 60 + 15), 375);
    return thetaPerDay * (elapsed / 375);
  }, [thetaPerDay]);

  const showGreeks = netDelta !== undefined && openPositions.length > 0 && (netDelta !== 0 || thetaPerDay !== 0);

  // Stable shift handlers — curried with direction at the table level
  const handleShiftUp = useCallback(
    (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) =>
      handleShift(token, tradingSymbol, product, broker, exchange)("up"),
    [handleShift],
  );

  const handleShiftDown = useCallback(
    (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) =>
      handleShift(token, tradingSymbol, product, broker, exchange)("down"),
    [handleShift],
  );

  return (
    <div className="flex h-full flex-col">
      {showFilter && (
        <PositionFilters
          brokerFilter={brokerFilter}
          setBrokerFilter={setBrokerFilter}
          productFilter={productFilter}
          onProductFilterChange={onProductFilterChange}
          brokersInPositions={brokersInPositions}
          filteredMtmByBroker={filteredMtmByBroker}
          showBrokerFilter={showBrokerFilter}
          showProductFilter={showProductFilter}
        />
      )}
      <div className="flex-1 overflow-auto">
        <PositionTable
          openPositions={openPositions}
          closedPositions={closedPositions}
          loading={loading}
          newPositionKeys={newPositionKeys}
          qtys={qtys}
          qtyMode={qtyMode}
          acting={acting}
          selected={selected}
          allSelected={allSelected}
          someSelected={someSelected}
          selectedCount={selectedCount}
          showGreeks={showGreeks}
          netDelta={netDelta}
          netGamma={netGamma}
          netVega={netVega}
          thetaPerDay={thetaPerDay}
          thetaEarnedToday={thetaEarnedToday}
          toggleSelectAll={toggleSelectAll}
          toggleSelect={toggleSelect}
          onQtyChange={setQty}
          onToggleMode={toggleMode}
          onAdd={handleAdd}
          onReduce={handleReduce}
          onShiftUp={handleShiftUp}
          onShiftDown={handleShiftDown}
          onExitSelected={handleExitSelected}
          onExitByType={handleExitByType}
        />
      </div>
    </div>
  );
}
