import { apiClient } from "@/lib/api-client";
import type { Position, Order, IndexContracts, OptionChainEntry } from "@/types";

export async function fetchPositions(exchanges?: string[]): Promise<Position[]> {
  const params = exchanges?.length ? { exchange: exchanges.join(",") } : undefined;
  const res = await apiClient.get<Position[]>("/api/upstox/positions", { params });
  return res.data.map((p) => ({ ...p, broker: "upstox" }));
}

export async function fetchZerodhaPositions(exchanges?: string[]): Promise<Position[]> {
  const params = exchanges?.length ? { exchange: exchanges.join(",") } : undefined;
  const res = await apiClient.get<Position[]>("/api/zerodha/positions", { params });
  return res.data.map((p) => ({ ...p, broker: "zerodha" }));
}

export async function exitAllPositions(exchanges = ["NFO", "BFO"]): Promise<void> {
  await apiClient.post("/api/upstox/positions/exit-all", null, {
    params: { exchange: exchanges.join(",") },
  });
}

export async function exitPosition(instrumentToken: string, product: string): Promise<void> {
  await apiClient.post(`/api/upstox/positions/${encodeURIComponent(instrumentToken)}/exit`, null, {
    params: { product },
  });
}

export async function convertPosition(
  instrumentToken: string,
  oldProduct: string,
  quantity: number,
): Promise<void> {
  await apiClient.post(`/api/upstox/positions/${encodeURIComponent(instrumentToken)}/convert`, {
    oldProduct,
    quantity,
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
  await apiClient.delete(`/api/upstox/orders/${encodeURIComponent(orderId)}/v3`);
}

// TransactionType: Buy = 0, Sell = 1  (matches backend enum order)
// Product: I=0, D=1, MTF=2, CO=3
function productToEnum(product: string): number {
  switch (product.toUpperCase()) {
    case "D": return 1;
    case "MTF": return 2;
    case "CO": return 3;
    default: return 0;
  }
}

export type PriceSearchMode = "Nearest" | "GreaterThan" | "LessThan";

export async function placeOrderByOptionPrice(params: {
  underlyingKey: string;
  expiryDate: string;
  optionType: "CE" | "PE";
  targetPremium: number;
  priceSearchMode: PriceSearchMode;
  quantity: number;
  transactionType: "Buy" | "Sell";
  product: string;
}): Promise<void> {
  await apiClient.post("/api/upstox/orders/by-option-price/v3", {
    underlyingKey: params.underlyingKey,
    expiryDate: params.expiryDate,
    optionType: params.optionType,
    targetPremium: params.targetPremium,
    priceSearchMode: params.priceSearchMode,
    quantity: params.quantity,
    transactionType: params.transactionType,
    product: productToEnum(params.product),
    slice: true,
  });
}

export async function fetchOptionChain(
  underlyingKey: string,
  expiryDate: string,
): Promise<OptionChainEntry[]> {
  const res = await apiClient.get<OptionChainEntry[]>("/api/upstox/options/chain", {
    params: { underlyingKey, expiryDate },
  });
  return res.data;
}

export async function fetchMasterContracts(broker: string): Promise<IndexContracts[]> {
  const res = await apiClient.get<IndexContracts[]>("/api/masterdata/contracts", {
    params: { broker },
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
): Promise<{ requiredMargin: number; finalMargin: number }> {
  const res = await apiClient.post<{ requiredMargin: number; finalMargin: number }>("/api/upstox/margin", {
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
): Promise<void> {
  await apiClient.post("/api/upstox/orders/v3", {
    instrumentToken,
    quantity,
    transactionType: transactionType === "Buy" ? 0 : 1,
    orderType: 0,  // Market
    product: productToEnum(product),
    slice: true,
  });
}

export async function placeOrder(
  instrumentToken: string,
  quantity: number,
  transactionType: "Buy" | "Sell",
  product: string,
  orderType: "market" | "limit",
  limitPrice?: number,
): Promise<void> {
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
