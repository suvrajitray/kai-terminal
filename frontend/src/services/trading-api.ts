import { apiClient } from "@/lib/api-client";
import type { Position, Order } from "@/types";

export async function fetchPositions(exchanges?: string[]): Promise<Position[]> {
  const params = exchanges?.length ? { exchange: exchanges.join(",") } : undefined;
  const res = await apiClient.get<Position[]>("/api/upstox/positions", { params });
  return res.data;
}

export async function exitAllPositions(): Promise<void> {
  await apiClient.post("/api/upstox/positions/exit-all");
}

export async function exitPosition(instrumentToken: string, product: string): Promise<void> {
  await apiClient.post(`/api/upstox/positions/${encodeURIComponent(instrumentToken)}/exit`, null, {
    params: { product },
  });
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await apiClient.get<Order[]>("/api/upstox/orders");
  return res.data;
}

export async function cancelAllOrders(): Promise<void> {
  await apiClient.post("/api/upstox/orders/cancel-all");
}

export async function cancelOrder(orderId: string): Promise<void> {
  await apiClient.delete(`/api/upstox/orders/${encodeURIComponent(orderId)}`);
}

// TransactionType: Buy = 0, Sell = 1  (matches backend enum order)
export async function placeMarketOrder(
  instrumentToken: string,
  quantity: number,
  transactionType: "Buy" | "Sell",
): Promise<void> {
  await apiClient.post("/api/upstox/orders", {
    instrumentToken,
    quantity,
    transactionType: transactionType === "Buy" ? 0 : 1,
    orderType: 0,  // Market
    product: 0,    // Intraday
  });
}
