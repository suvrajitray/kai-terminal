import axios from 'axios';
import { PlaceOrderRequest, Position, UpstoxCredentials } from '../models/common.types';
import { UpstoxOrderRequest } from '../models/upstox.types';

export class UpstoxService {
    private readonly API_BASE_URL = 'https://api.upstox.com/v2';
    private readonly HFT_BASE_URL = 'https://api-hft.upstox.com/v3';

    mapToUpstoxOrder(order: PlaceOrderRequest): UpstoxOrderRequest {
        return {
            instrument_token: order.symbol,
            quantity: order.quantity,
            product: order.product === 'INTRADAY' ? 'I' : 'D',
            validity: 'DAY',
            price: order.price || 0,
            order_type: order.type,
            transaction_type: order.action,
            disclosed_quantity: 0,
            trigger_price: order.triggerPrice || 0,
            is_amo: false,
            slice: false
        };
    }

    private getHeaders(credentials: UpstoxCredentials) {
        return {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    async getPositions(credentials: UpstoxCredentials): Promise<Position[]> {
        console.log(`[Upstox] Fetching real positions...`);
        try {
            // Usually portfolio endpoints are on the standard v2 API
            const response = await axios.get(`${this.API_BASE_URL}/portfolio/short-term-positions`, {
                headers: this.getHeaders(credentials)
            });

            const positions = response.data.data || [];
            return positions.map((p: any) => ({
                symbol: p.tradingsymbol || p.instrument_token,
                exchange: 'NSE', 
                product: p.product as any,
                netQuantity: p.quantity || p.net_quantity || 0
            }));
        } catch (error: any) {
            console.error('[Upstox] Failed to get positions:', error?.response?.data || error.message);
            throw new Error(`Upstox getPositions failed: ${error.message}`);
        }
    }

    async placeOrder(orderPayload: UpstoxOrderRequest, credentials: UpstoxCredentials): Promise<string> {
        console.log(`[Upstox] Placing ${orderPayload.transaction_type} order for ${orderPayload.instrument_token} x ${orderPayload.quantity}`);
        try {
            // V3 Order placement happens on HFT base URL
            const response = await axios.post(`${this.HFT_BASE_URL}/order/place`, orderPayload, {
                headers: this.getHeaders(credentials)
            });

            // V3 orders return order_ids array
            if (response.data.data?.order_ids && response.data.data.order_ids.length > 0) {
                return response.data.data.order_ids[0];
            } else if (response.data.data?.order_id) {
                return response.data.data.order_id;
            }
            throw new Error('No order ID found in response');
        } catch (error: any) {
            console.error('[Upstox] Failed to place order:', error?.response?.data || error.message);
            throw new Error(`Upstox placeOrder failed: ${error.message}`);
        }
    }
}
