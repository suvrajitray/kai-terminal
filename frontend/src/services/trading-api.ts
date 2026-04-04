import { apiClient } from "@/lib/api-client";
import type { Position, Order, IndexContracts, OptionChainEntry, IvSnapshot } from "@/types";

export async function fetchPositions(exchanges?: string[]): Promise<Position[]> {
  const params = exchanges?.length ? { exchange: exchanges.join(",") } : undefined;
  const res = await apiClient.get<Position[]>("/api/upstox/positions", { params });
  return res.data;
}

export async function fetchZerodhaPositions(exchanges?: string[]): Promise<Position[]> {
  const params = exchanges?.length ? { exchange: exchanges.join(",") } : undefined;
  const res = await apiClient.get<Position[]>("/api/zerodha/positions", { params });
  return res.data;
}

export async function exitAllPositions(exchanges?: string[]): Promise<void> {
  const params = exchanges?.length ? { exchange: exchanges.join(",") } : undefined;
  await apiClient.post("/api/upstox/positions/exit-all", null, { params });
}

export async function exitAllZerodhaPositions(exchanges?: string[]): Promise<void> {
  const params = exchanges?.length ? { exchange: exchanges.join(",") } : undefined;
  await apiClient.post("/api/zerodha/positions/exit-all", null, { params });
}

export async function exitPosition(
  instrumentToken: string,
  product: string,
  broker: string = "upstox",
): Promise<void> {
  if (broker === "zerodha") {
    await apiClient.post(`/api/zerodha/positions/${encodeURIComponent(instrumentToken)}/exit`);
  } else {
    await apiClient.post(`/api/upstox/positions/${encodeURIComponent(instrumentToken)}/exit`, null, {
      params: { product: productToUpstoxStr(product) },
    });
  }
}

export async function convertPosition(
  instrumentToken: string,
  oldProduct: string,
  quantity: number,
  broker: string = "upstox",
): Promise<void> {
  if (broker === "zerodha") {
    await apiClient.post(`/api/zerodha/positions/${encodeURIComponent(instrumentToken)}/convert`, {
      oldProduct,
      quantity,
    });
  } else {
    await apiClient.post(`/api/upstox/positions/${encodeURIComponent(instrumentToken)}/convert`, {
      oldProduct: productToUpstoxStr(oldProduct),
      quantity,
    });
  }
}

export async function fetchOrders(brokers: string[] = ["upstox"]): Promise<Order[]> {
  const results = await Promise.allSettled(
    brokers.map((b) => apiClient.get<Order[]>(`/api/${b}/orders`).then((r) => r.data.map((o) => ({ ...o, broker: b }))))
  );
  return results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
}

export async function cancelAllOrders(): Promise<void> {
  await apiClient.post("/api/upstox/orders/cancel-all");
}

export async function cancelOrder(orderId: string): Promise<void> {
  await apiClient.delete(`/api/upstox/orders/${encodeURIComponent(orderId)}/v3`);
}

// Maps ProductType enum strings (or legacy "I"/"D") to Upstox numeric enum for order placement
// Upstox Product enum: Intraday=0, Delivery=1, MTF=2, CoverOrder=3
function productToEnum(product: string): number {
  switch (product) {
    case "Delivery": case "D": return 1;
    case "Mtf":      case "MTF": return 2;
    case "CoverOrder": case "CO": return 3;
    default: return 0;  // "Intraday", "I", anything else
  }
}

// Maps ProductType enum strings back to Upstox raw string values for broker-specific endpoints
// (exit position, convert position) that pass the product directly to the Upstox API
function productToUpstoxStr(product: string): string {
  switch (product) {
    case "Delivery": return "D";
    case "Mtf":      return "MTF";
    case "CoverOrder": return "CO";
    default: return "I";  // "Intraday"
  }
}

export async function fetchOptionChain(
  underlyingKey: string,
  expiryDate: string,
): Promise<OptionChainEntry[]> {
  const res = await apiClient.get<OptionChainEntry[]>("/api/masterdata/options/chain", {
    params: { underlyingKey, expiryDate },
  });
  return res.data;
}

export async function fetchMasterContracts(): Promise<IndexContracts[]> {
  const res = await apiClient.get<IndexContracts[]>("/api/masterdata/contracts");
  return res.data;
}

export async function fetchIvHistory(underlying: string): Promise<IvSnapshot[]> {
  const res = await apiClient.get<IvSnapshot[]>("/api/masterdata/iv-history", {
    params: { underlying },
  });
  return res.data;
}

export interface MarginInstrument {
  instrumentToken: string;
  quantity: number;
  product: string;
  transactionType: string;
}

export async function fetchMargin(
  instruments: MarginInstrument[],
  broker: "upstox" | "zerodha" = "upstox",
): Promise<{ requiredMargin: number; finalMargin: number }> {
  const res = await apiClient.post<{ requiredMargin: number; finalMargin: number }>(`/api/${broker}/margin`, {
    instruments,
  });
  return res.data;
}

export interface FundsData {
  availableMargin: number | null;
  usedMargin: number | null;
  payinAmount: number | null;
}

export async function fetchFunds(): Promise<FundsData> {
  const res = await apiClient.get<FundsData>("/api/upstox/funds");
  return res.data;
}

export async function fetchZerodhaFunds(apiKey: string, accessToken: string): Promise<FundsData> {
  const res = await apiClient.get<FundsData>("/api/zerodha/funds", {
    headers: {
      "X-Zerodha-Api-Key":      apiKey,
      "X-Zerodha-Access-Token": accessToken,
    },
  });
  return res.data;
}

export async function placeMarketOrder(
  instrumentToken: string,
  quantity: number,
  transactionType: "Buy" | "Sell",
  product: string,
  broker: string = "upstox",
  exchange?: string,
): Promise<void> {
  if (broker === "zerodha") {
    const token = exchange ? `${exchange}|${instrumentToken}` : instrumentToken;
    await apiClient.post("/api/zerodha/orders/v3", {
      instrumentToken: token,
      quantity,
      transactionType,
      product,
      orderType: "Market",
      price: null,
    });
  } else {
    await apiClient.post("/api/upstox/orders/v3", {
      instrumentToken,
      quantity,
      transactionType: transactionType === "Buy" ? 0 : 1,
      orderType: 0,  // Market
      product: productToEnum(product),
      slice: true,
    });
  }
}

export interface ShiftPositionPayload {
  instrumentToken: string;
  exchange: string;
  qty: number;
  direction: "up" | "down";
  product: string;
  currentStrike: number;
  strikeGap: number;
  underlyingKey: string;
  expiry: string;
  instrumentType: string;
  isShort: boolean;
}

export async function shiftPosition(broker: string, payload: ShiftPositionPayload): Promise<void> {
  await apiClient.post(`/api/${broker}/positions/shift`, payload);
}

export interface ByPriceOrderPayload {
  underlyingKey: string;
  expiry: string;
  instrumentType: string;
  targetPremium: number;
  qty: number;
  transactionType: "Buy" | "Sell";
  product: string;
}

export async function placeOrderByPrice(broker: string, payload: ByPriceOrderPayload): Promise<void> {
  await apiClient.post(`/api/${broker}/orders/by-price`, payload);
}

export async function placeOrder(
  instrumentToken: string,
  quantity: number,
  transactionType: "Buy" | "Sell",
  product: string,
  orderType: "market" | "limit",
  limitPrice?: number,
  broker: string = "upstox",
  exchange?: string,
): Promise<void> {
  if (broker === "zerodha") {
    const token = exchange ? `${exchange}|${instrumentToken}` : instrumentToken;
    await apiClient.post("/api/zerodha/orders/v3", {
      instrumentToken: token,
      quantity,
      transactionType,
      product,
      orderType: orderType === "market" ? "Market" : "Limit",
      price: orderType === "limit" ? (limitPrice ?? 0) : null,
    });
  } else {
    await apiClient.post("/api/upstox/orders/v3", {
      instrumentToken,
      quantity,
      transactionType: transactionType === "Buy" ? 0 : 1,
      orderType: orderType === "market" ? 0 : 1,
      price: orderType === "limit" ? (limitPrice ?? 0) : 0,
      product: productToEnum(product),
      slice: true,
    });
  }
}

export async function placeStoplossOrder(
  instrumentToken: string,
  quantity: number,
  transactionType: "Buy" | "Sell",
  product: string,
  triggerPrice: number,
  broker: string,
  exchange?: string,
): Promise<void> {
  if (broker === "zerodha") {
    const token = exchange ? `${exchange}|${instrumentToken}` : instrumentToken;
    await apiClient.post("/api/zerodha/orders/v3", {
      instrumentToken: token,
      quantity,
      transactionType,
      product,
      orderType: "SL-M",
      triggerPrice,
    });
  } else {
    await apiClient.post("/api/upstox/orders/v3", {
      instrumentToken,
      quantity,
      transactionType: transactionType === "Buy" ? 0 : 1,
      orderType: 3, // SLM
      triggerPrice,
      price: 0,
      product: productToEnum(product),
      slice: true,
    });
  }
}
