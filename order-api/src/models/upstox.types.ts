export interface UpstoxOrderRequest {
    instrument_token: string;
    quantity: number;
    product: string;
    validity: string;
    price: number;
    tag?: string;
    order_type: string;
    transaction_type: string;
    disclosed_quantity: number;
    trigger_price: number;
    is_amo: boolean;
    slice: boolean;
}

export interface UpstoxPositionResponse {
    status: string;
    data: Array<{
        instrument_token: string;
        product: string;
        quantity: number;
        tradingsymbol: string;
    }>;
}
