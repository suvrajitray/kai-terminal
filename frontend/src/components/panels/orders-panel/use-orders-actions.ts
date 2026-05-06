import { useCallback } from "react";
import { fetchOrders, cancelAllOrders, cancelOrder } from "@/services/trading-api";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useBrokerStore } from "@/stores/broker-store";
import { BROKERS } from "@/lib/constants";
import type { Order } from "@/types";

interface UseOrdersActionsArgs {
  loadStart: () => void;
  loadSuccess: (orders: Order[]) => void;
  loadError: (error: string) => void;
  cancelStart: (id: string) => void;
  cancelDone: () => void;
  cancelError: (error: string) => void;
}

export function useOrdersActions({
  loadStart, loadSuccess, loadError, cancelStart, cancelDone, cancelError,
}: UseOrdersActionsArgs) {
  const load = useCallback(async () => {
    const activeBrokers = BROKERS
      .map((b) => b.id)
      .filter((id) => {
        const token = useBrokerStore.getState().getCredentials(id)?.accessToken;
        return !isBrokerTokenExpired(id, token);
      });
    if (activeBrokers.length === 0) return;
    loadStart();
    try {
      const data = await fetchOrders(activeBrokers);
      loadSuccess([...data].reverse());
    } catch (e) {
      loadError((e as Error).message);
    }
  }, [loadStart, loadSuccess, loadError]);

  const handleCancelAll = useCallback(async (openOrders: Order[]) => {
    cancelStart("all");
    try {
      const brokersWithOpenOrders = [...new Set(openOrders.map((o) => o.broker).filter(Boolean))] as string[];
      await Promise.all(brokersWithOpenOrders.map((b) => cancelAllOrders(b)));
      await load();
      cancelDone();
    } catch (e) {
      cancelError((e as Error).message);
    }
  }, [cancelStart, cancelDone, cancelError, load]);

  const handleCancel = useCallback(async (orderId: string, broker?: string) => {
    cancelStart(orderId);
    try {
      await cancelOrder(orderId, broker);
      await load();
      cancelDone();
    } catch (e) {
      cancelError((e as Error).message);
    }
  }, [cancelStart, cancelDone, cancelError, load]);

  return { load, handleCancelAll, handleCancel };
}
