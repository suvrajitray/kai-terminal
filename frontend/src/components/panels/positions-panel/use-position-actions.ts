import { useCallback, useState } from "react";
import { toast } from "@/lib/toast";
import { exitPosition, placeMarketOrder, shiftPosition } from "@/services/trading-api";
import { getShiftOffset, UNDERLYING_KEYS } from "@/lib/shift-config";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import type { Position } from "@/types";
import { selectionKey } from "./position-keys";

interface UsePositionActionsArgs {
  positions: Position[];
  openPositions: Position[];
  selected: Set<string>;
  resolveQty: (token: string, tradingSymbol: string) => number;
  clearSelected: () => void;
  load: () => void;
}

export function usePositionActions({
  positions,
  openPositions,
  selected,
  resolveQty,
  clearSelected,
  load,
}: UsePositionActionsArgs) {
  const [acting, setActing] = useState<string | null>(null);
  const getByInstrumentKey = useOptionContractsStore((state) => state.getByInstrumentKey);

  const withActing = useCallback(async (key: string, fn: () => Promise<void>) => {
    setActing(key);
    try {
      await fn();
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setActing(null);
    }
  }, [load]);

  const handleAdd = useCallback((
    token: string,
    tradingSymbol: string,
    product: string,
    broker: string,
    exchange: string,
  ) => {
    const qty = resolveQty(token, tradingSymbol);
    const position = positions.find((current) => current.instrumentToken === token && current.product === product);
    if (!position) return;

    const transactionType = position.quantity >= 0 ? "Buy" : "Sell";
    return withActing(`${token}:add`, () => placeMarketOrder(token, qty, transactionType, product, broker, exchange));
  }, [positions, resolveQty, withActing]);

  const handleReduce = useCallback((
    token: string,
    tradingSymbol: string,
    product: string,
    broker: string,
    exchange: string,
  ) => {
    const qty = resolveQty(token, tradingSymbol);
    const position = positions.find((current) => current.instrumentToken === token && current.product === product);
    if (!position) return;

    const transactionType = position.quantity >= 0 ? "Sell" : "Buy";
    return withActing(`${token}:reduce`, () => placeMarketOrder(token, qty, transactionType, product, broker, exchange));
  }, [positions, resolveQty, withActing]);

  const handleShift = useCallback((
    token: string,
    tradingSymbol: string,
    product: string,
    broker: string,
    exchange: string,
    direction: "up" | "down",
  ) => {
    const lookup = getByInstrumentKey(token, tradingSymbol);
    if (!lookup) return;

    const qty = resolveQty(token, tradingSymbol);
    if (qty === 0) return;

    const position = positions.find((current) => current.instrumentToken === token && current.product === product);
    if (!position) return;

    const { contract, index } = lookup;
    const strikeGap = getShiftOffset(index);
    const underlyingKey = UNDERLYING_KEYS[index];

    return withActing(`${token}:shift-${direction}`, async () => {
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
  }, [getByInstrumentKey, positions, resolveQty, withActing]);

  const handleExitSelected = useCallback(async () => {
    const toExit = openPositions.filter((position) => selected.has(selectionKey(position)));
    setActing("selected");
    try {
      await Promise.all(toExit.map((position) => exitPosition(position.instrumentToken, position.product, position.broker ?? "upstox")));
      clearSelected();
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setActing(null);
    }
  }, [clearSelected, load, openPositions, selected]);

  const handleExitByType = useCallback((instrumentType: "CE" | "PE") => async () => {
    const toExit = openPositions.filter((position) => {
      const lookup = getByInstrumentKey(position.instrumentToken, position.tradingSymbol);
      return lookup?.contract.instrumentType === instrumentType;
    });

    if (toExit.length === 0) return;

    setActing(`type-${instrumentType}`);
    try {
      await Promise.all(toExit.map((position) => exitPosition(position.instrumentToken, position.product, position.broker ?? "upstox")));
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setActing(null);
    }
  }, [getByInstrumentKey, load, openPositions]);

  const handleShiftUp = useCallback(
    (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) =>
      handleShift(token, tradingSymbol, product, broker, exchange, "up"),
    [handleShift],
  );

  const handleShiftDown = useCallback(
    (token: string, tradingSymbol: string, product: string, broker: string, exchange: string) =>
      handleShift(token, tradingSymbol, product, broker, exchange, "down"),
    [handleShift],
  );

  return {
    acting,
    handleAdd,
    handleReduce,
    handleShiftUp,
    handleShiftDown,
    handleExitSelected,
    handleExitByType,
  };
}

