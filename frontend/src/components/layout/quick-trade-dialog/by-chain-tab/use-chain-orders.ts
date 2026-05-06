import { useCallback, useMemo } from "react";
import { toast } from "@/lib/toast";
import { placeMarketOrder, type MarginInstrument } from "@/services/trading-api";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { useDirectMarginEstimate } from "../../use-margin-estimate";
import type { ActionType, ChainRow, Direction } from "./types";

interface UseChainOrdersArgs {
  broker: "upstox" | "zerodha";
  exchange: string;
  product: "I" | "D";
  quantity: number;
  direction: Direction;
  selected: ChainRow | null;
  onExecuteStart: (action: ActionType) => void;
  onExecuteDone: () => void;
}

export function useChainOrders({
  broker,
  exchange,
  product,
  quantity,
  direction,
  selected,
  onExecuteStart,
  onExecuteDone,
}: UseChainOrdersArgs) {
  const getByInstrumentKey = useOptionContractsStore((state) => state.getByInstrumentKey);
  const isBuy = direction === "Buy";

  const marginInstruments = useMemo<MarginInstrument[] | null>(() => {
    if (!selected?.ceKey || !selected.peKey) return null;

    return [
      { instrumentToken: selected.ceKey, quantity, product, transactionType: isBuy ? "BUY" : "SELL" },
      { instrumentToken: selected.peKey, quantity, product, transactionType: isBuy ? "BUY" : "SELL" },
    ];
  }, [isBuy, product, quantity, selected]);

  const { margin, loading: marginLoading } = useDirectMarginEstimate(marginInstruments, broker);

  const execute = useCallback(async (action: ActionType) => {
    if (!selected) {
      toast.error("Select a row first");
      return;
    }

    const { ceKey, peKey } = selected;

    if ((action === "CE" || action === "BOTH") && !ceKey) {
      toast.error("CE instrument not available");
      return;
    }
    if ((action === "PE" || action === "BOTH") && !peKey) {
      toast.error("PE instrument not available");
      return;
    }

    function resolveToken(upstoxKey: string): string | null {
      if (broker === "upstox") return upstoxKey;
      const lookup = getByInstrumentKey(upstoxKey);
      return lookup?.contract.zerodhaToken || null;
    }

    const ceToken = ceKey ? resolveToken(ceKey) : null;
    const peToken = peKey ? resolveToken(peKey) : null;

    if ((action === "CE" || action === "BOTH") && !ceToken) {
      toast.error("CE contract not found");
      return;
    }
    if ((action === "PE" || action === "BOTH") && !peToken) {
      toast.error("PE contract not found");
      return;
    }

    const zerodhaExchange = broker === "zerodha" ? exchange : undefined;
    const orders: Promise<void>[] = [];

    if (action === "CE" || action === "BOTH") {
      orders.push(placeMarketOrder(ceToken!, quantity, direction, product, broker, zerodhaExchange));
    }
    if (action === "PE" || action === "BOTH") {
      orders.push(placeMarketOrder(peToken!, quantity, direction, product, broker, zerodhaExchange));
    }

    onExecuteStart(action);
    try {
      await Promise.all(orders);
      toast.success("Order placed");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      onExecuteDone();
    }
  }, [selected, broker, exchange, product, quantity, direction, onExecuteStart, onExecuteDone, getByInstrumentKey]);

  return { execute, isBuy, margin, marginLoading };
}

