export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface BrokerInfo {
  id: string;
  name: string;
  description: string;
  color: string;
  features: string[];
  connected: boolean;
  redirectPath: string;
}

export interface BrokerCredentials {
  apiKey: string;
  apiSecret: string;
  redirectUrl: string;
  accessToken?: string;
}

export type ProductType = "Intraday" | "Delivery" | "Mtf" | "CoverOrder";
export type OrderSide = "Buy" | "Sell";
export type TradeOrderType = "Market" | "Limit" | "StopLoss" | "StopLossMarket";
export type OrderValidity = "Day" | "IOC";

// CamelCase matches the unified KAI Terminal PositionResponse DTO from the backend
export interface Position {
  exchange: string;
  instrumentToken: string;
  tradingSymbol: string;
  product: ProductType;
  quantity: number;
  buyQuantity: number;
  sellQuantity: number;
  averagePrice: number;
  ltp: number;
  pnl: number;
  unrealised: number;
  realised: number;
  buyPrice: number;
  sellPrice: number;
  buyValue: number;
  sellValue: number;
  /** Which broker this position belongs to — "upstox" | "zerodha". Set by backend. */
  broker: string;
  isOpen: boolean;
}

export interface OptionMarketData {
  ltp: number;
  volume: number;
  oi: number;
  closePrice: number;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
}

export interface OptionSide {
  instrumentKey: string;
  marketData?: OptionMarketData;
}

export interface OptionChainEntry {
  expiry: string;
  strikePrice: number;
  underlyingKey: string;
  underlyingSpotPrice: number;
  pcr: number;
  callOptions?: OptionSide;
  putOptions?: OptionSide;
}

export interface ContractEntry {
  expiry: string;
  exchangeToken: string;
  lotSize: number;
  instrumentType: "CE" | "PE";
  upstoxToken: string;       // "NSE_FO|37590"  — empty for Zerodha rows
  zerodhaToken: string;    // "15942914"      — raw numeric token, empty for Upstox rows
  strikePrice: number;
}

export interface IndexContracts {
  index: string;
  contracts: ContractEntry[];
}

export type RiskNotificationType =
  | "SessionStarted"
  | "HardSlHit"
  | "TargetHit"
  | "TslActivated"
  | "TslRaised"
  | "TslHit"
  | "SquareOffComplete"
  | "SquareOffFailed";

export interface RiskEvent {
  userId:            string;
  broker:            string;
  type:              RiskNotificationType;
  mtm:               number;
  target:            number | null;
  sl:                number | null;
  tslFloor:          number | null;
  openPositionCount: number | null;
  timestamp:         string;
}

// CamelCase matches the unified KAI Terminal OrderResponse DTO from the backend
export interface Order {
  orderId: string;
  exchangeOrderId: string;
  exchange: string;
  tradingSymbol: string;
  product: ProductType;
  orderType: TradeOrderType;
  transactionType: OrderSide;
  validity: OrderValidity;
  status: string;
  statusMessage: string;
  price: number;
  averagePrice: number;
  quantity: number;
  filledQuantity: number;
  pendingQuantity: number;
  tag: string | null;
  orderTimestamp: string | null;
}
