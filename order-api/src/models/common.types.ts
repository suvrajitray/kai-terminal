export type OrderAction = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type ProductType = 'CNC' | 'INTRADAY' | 'MARGIN' | 'NRML' | 'MIS';

export interface PlaceOrderRequest {
    symbol: string;
    exchange: string;
    action: OrderAction;
    type: OrderType;
    product: ProductType;
    quantity: number;
    price?: number;
    triggerPrice?: number;
}

export interface Position {
    symbol: string;
    exchange: string;
    product: ProductType;
    netQuantity: number;
}

export interface ZerodhaCredentials {
    apiKey: string;
    accessToken: string;
}

export interface UpstoxCredentials {
    accessToken: string;
}
