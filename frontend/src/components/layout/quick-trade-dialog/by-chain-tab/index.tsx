import React, { useCallback, useEffect, useRef } from "react";
import { toast } from "@/lib/toast";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { fetchOptionChain } from "@/services/trading-api";
import { type QtyMode } from "@/components/ui/qty-input";
import { ChainControls } from "./chain-controls";
import { ChainActionButtons } from "./chain-action-buttons";
import { ChainHeader } from "./chain-header";
import { buildChainRows } from "./chain-rows";
import { ChainTable } from "./chain-table";
import { SelectedRowSummary } from "./selected-row-summary";
import { useChainOrders } from "./use-chain-orders";
import { useChainState } from "./use-chain-state";

interface Props {
  broker: "upstox" | "zerodha";
  underlying: string;
  expiry: string;
  product: "I" | "D";
  quantity: number;
  isActive: boolean;
  qtyValue: string;
  qtyMode: QtyMode;
  lotSize: number;
  onQtyChange: (v: string) => void;
  onToggleMode: () => void;
}

export const ByChainTab = React.memo(function ByChainTab({
  broker,
  underlying,
  expiry,
  product,
  quantity,
  isActive,
  qtyValue,
  qtyMode,
  lotSize,
  onQtyChange,
  onToggleMode,
}: Props) {
  const chainState = useChainState();
  const {
    chain,
    loading,
    mode,
    selectedDiff,
    direction,
    acting,
    startLoading,
    loadSuccess,
    loadError,
    setMode,
    setSelectedDiff,
    setDirection,
    executeStart,
    executeDone,
  } = chainState;

  const atmRowRef = useRef<HTMLTableRowElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const underlyingKey = UNDERLYING_KEYS[underlying];
  const spotPrice = chain[0]?.underlyingSpotPrice ?? 0;
  const exchange = underlyingKey?.startsWith("BSE_") ? "BFO" : "NFO";
  const { rows, atmStrike } = buildChainRows(chain, spotPrice, mode);
  const selected = rows.find((row) => row.diff === selectedDiff) ?? null;
  const scrollTargetDiff = mode === "straddle" ? 0 : rows[0]?.diff ?? 0;

  const loadChain = useCallback(async () => {
    if (!expiry || !underlyingKey) return;

    startLoading();
    try {
      const data = await fetchOptionChain(underlyingKey, expiry);
      loadSuccess(data);
    } catch (error) {
      toast.error((error as Error).message ?? "Failed to load option chain");
      loadError();
    }
  }, [expiry, loadError, loadSuccess, startLoading, underlyingKey]);

  useEffect(() => {
    if (isActive && expiry) loadChain();
  }, [expiry, isActive, loadChain, underlying]);

  useEffect(() => {
    if (loading || !atmRowRef.current || !scrollRef.current) return;

    const container = scrollRef.current;
    const row = atmRowRef.current;
    const offset = row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2;
    container.scrollTop = Math.max(0, offset);
  }, [loading, mode, rows.length]);

  const { execute, isBuy, margin, marginLoading } = useChainOrders({
    broker,
    exchange,
    product,
    quantity,
    direction,
    selected,
    onExecuteStart: executeStart,
    onExecuteDone: executeDone,
  });

  return (
    <div className="space-y-4">
      <ChainHeader
        mode={mode}
        loading={loading}
        spotPrice={spotPrice}
        atmStrike={atmStrike}
        onModeChange={setMode}
        onRefresh={loadChain}
      />

      <ChainTable
        ref={scrollRef}
        rows={rows}
        loading={loading}
        expiry={expiry}
        mode={mode}
        selectedDiff={selectedDiff}
        scrollTargetDiff={scrollTargetDiff}
        onSelectedDiffChange={setSelectedDiff}
        onTargetRow={(element) => {
          atmRowRef.current = element;
        }}
      />

      <SelectedRowSummary selected={selected} mode={mode} />

      <ChainControls
        qtyValue={qtyValue}
        qtyMode={qtyMode}
        lotSize={lotSize}
        direction={direction}
        margin={margin}
        marginLoading={marginLoading}
        onQtyChange={onQtyChange}
        onToggleMode={onToggleMode}
        onDirectionChange={setDirection}
      />

      <ChainActionButtons
        acting={acting}
        disabled={!selected}
        isBuy={isBuy}
        onExecute={execute}
      />
    </div>
  );
});

