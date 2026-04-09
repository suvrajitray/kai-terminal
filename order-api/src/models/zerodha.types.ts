export interface ZerodhaOrderRequest {
    tradingsymbol: string;
    exchange: string;
    transaction_type: 'BUY' | 'SELL';
    order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
    quantity: number;
    product: 'CNC' | 'NRML' | 'MIS' | 'BO' | 'CO';
    price?: number;
    trigger_price?: number;
}

export interface ZerodhaPositionResponse {
    status: string;
    data: {
        net: Array<{
            tradingsymbol: string;
            exchange: string;
            product: string;
            quantity: number;
        }>;
    };
}
