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

// Snake_case matches Upstox JSON property names from the backend
export interface Position {
  exchange: string;
  instrument_token: string;
  trading_symbol: string;
  product: string;
  quantity: number;
  multiplier: number;
  average_price: number;
  last_price: number;
  pnl: number;
  unrealised: number;
  realised: number;
  buy_price: number;
  sell_price: number;
  day_buy_quantity: number;
  day_sell_quantity: number;
}

export interface Order {
  order_id: string;
  exchange_order_id: string;
  exchange: string;
  trading_symbol: string;
  product: string;
  order_type: string;
  transaction_type: string;
  validity: string;
  status: string;
  status_message: string;
  price: number;
  trigger_price: number;
  quantity: number;
  filled_quantity: number;
  pending_quantity: number;
  average_price: number;
  tag: string | null;
  order_timestamp: string | null;
}
