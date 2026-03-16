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

export interface OptionMarketData {
  ltp: number;
  volume: number;
  oi: number;
  close_price: number;
  bid_price: number;
  bid_qty: number;
  ask_price: number;
  ask_qty: number;
}

export interface OptionSide {
  instrument_key: string;
  market_data?: OptionMarketData;
}

export interface OptionChainEntry {
  expiry: string;
  strike_price: number;
  underlying_key: string;
  underlying_spot_price: number;
  pcr: number;
  call_options?: OptionSide;
  put_options?: OptionSide;
}

export interface OptionContract {
  instrument_key: string;
  trading_symbol: string;
  expiry: string;
  strike_price: number;
  instrument_type: "CE" | "PE";
  lot_size: number;
  underlying_key: string;
  underlying_symbol: string;
  exchange: string;
  weekly: boolean;
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
