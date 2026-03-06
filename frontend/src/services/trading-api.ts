import { apiClient } from "@/lib/api-client";
import type { Position, Order } from "@/types";

export async function fetchPositions(): Promise<Position[]> {
  const res = await apiClient.get<Position[]>("/api/upstox/positions");
  return res.data;
}

export async function exitAllPositions(): Promise<void> {
  await apiClient.post("/api/upstox/positions/exit-all");
}

export async function exitPosition(instrumentToken: string): Promise<void> {
  await apiClient.post(`/api/upstox/positions/${encodeURIComponent(instrumentToken)}/exit`);
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
