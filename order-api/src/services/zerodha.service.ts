import axios from 'axios';
import { PlaceOrderRequest, Position, ZerodhaCredentials } from '../models/common.types';
import { ZerodhaOrderRequest, ZerodhaPositionResponse } from '../models/zerodha.types';

export class ZerodhaService {
    private readonly BASE_URL = 'https://api.kite.trade';

    mapToZerodhaOrder(order: PlaceOrderRequest): ZerodhaOrderRequest {
        return {
            tradingsymbol: order.symbol,
            exchange: order.exchange,
            transaction_type: order.action,
            order_type: order.type,
            quantity: order.quantity,
            product: order.product === 'INTRADAY' ? 'MIS' : order.product === 'CNC' ? 'CNC' : 'NRML',
            price: order.price,
            trigger_price: order.triggerPrice
        };
    }

    private getHeaders(credentials: ZerodhaCredentials) {
        return {
            'X-Kite-Version': '3',
            'Authorization': `token ${credentials.apiKey}:${credentials.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        };
    }

    async getPositions(credentials: ZerodhaCredentials): Promise<Position[]> {
        console.log(`[Zerodha] Fetching real positions...`);
        try {
            const response = await axios.get<ZerodhaPositionResponse>(`${this.BASE_URL}/portfolio/positions`, {
                headers: this.getHeaders(credentials)
            });

            const positions = response.data.data.net;
            return positions.map(p => ({
                symbol: p.tradingsymbol,
                exchange: p.exchange,
                product: p.product as any,
                netQuantity: p.quantity
            }));
        } catch (error: any) {
            console.error('[Zerodha] Failed to get positions:', error?.response?.data || error.message);
            throw new Error(`Zerodha getPositions failed: ${error.message}`);
        }
    }

    async placeOrder(orderPayload: ZerodhaOrderRequest, credentials: ZerodhaCredentials): Promise<string> {
        console.log(`[Zerodha] Placing ${orderPayload.transaction_type} order for ${orderPayload.tradingsymbol} x ${orderPayload.quantity}`);
        try {
            const formData = new URLSearchParams();
            for (const [key, value] of Object.entries(orderPayload)) {
                if (value !== undefined) formData.append(key, value.toString());
            }

            const response = await axios.post(`${this.BASE_URL}/orders/regular`, formData, {
                headers: this.getHeaders(credentials)
            });

            return response.data.data.order_id;
        } catch (error: any) {
            console.error('[Zerodha] Failed to place order:', error?.response?.data || error.message);
            throw new Error(`Zerodha placeOrder failed: ${error.message}`);
        }
    }
}
