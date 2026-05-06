export type SupportedBroker = "upstox" | "zerodha";
export type OrderDirection = "Buy" | "Sell";
export type ProductType = "Intraday" | "Delivery";
export type OrderType = "market" | "limit";

export interface OrderAccent {
  border: string;
  dot: string;
  btn: string;
  toggle: string;
}

export interface ActiveBroker {
  id: string;
  name: string;
}

