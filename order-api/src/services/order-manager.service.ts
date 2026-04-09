import { PlaceOrderRequest } from '../models/common.types';
import { ZerodhaService } from './zerodha.service';
import { UpstoxService } from './upstox.service';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class OrderManagerService {
    private zerodhaService: ZerodhaService;
    private upstoxService: UpstoxService;

    constructor() {
        this.zerodhaService = new ZerodhaService();
        this.upstoxService = new UpstoxService();
    }

    async getPositions(broker: 'ZERODHA' | 'UPSTOX', credentials: any) {
        if (broker === 'ZERODHA') return this.zerodhaService.getPositions(credentials);
        return this.upstoxService.getPositions(credentials);
    }

    async isPositionOpen(broker: 'ZERODHA' | 'UPSTOX', symbol: string, credentials: any): Promise<boolean> {
        const positions = await this.getPositions(broker, credentials);
        const position = positions.find(p => p.symbol === symbol);
        return position !== undefined && position.netQuantity !== 0;
    }

    async placeOrder(broker: 'ZERODHA' | 'UPSTOX', order: PlaceOrderRequest, credentials: any): Promise<string> {
        if (broker === 'ZERODHA') {
            const mappedOrder = this.zerodhaService.mapToZerodhaOrder(order);
            return this.zerodhaService.placeOrder(mappedOrder, credentials);
        } else {
            const mappedOrder = this.upstoxService.mapToUpstoxOrder(order);
            return this.upstoxService.placeOrder(mappedOrder, credentials);
        }
    }

    async exitPosition(broker: 'ZERODHA' | 'UPSTOX', order: PlaceOrderRequest, credentials: any): Promise<string> {
        const isOpen = await this.isPositionOpen(broker, order.symbol, credentials);
        if (!isOpen) {
            throw new Error(`Position for ${order.symbol} is already exited or does not exist.`);
        }
        return this.placeOrder(broker, order, credentials);
    }

    async exitAll(broker: 'ZERODHA' | 'UPSTOX', credentials: any) {
        const positions = await this.getPositions(broker, credentials);
        const openPositions = positions.filter(p => p.netQuantity !== 0);

        if (openPositions.length === 0) {
            return { message: "No open positions to exit." };
        }

        const shortPositions = openPositions.filter(p => p.netQuantity < 0);
        const longPositions = openPositions.filter(p => p.netQuantity > 0);

        const results: string[] = [];

        if (shortPositions.length > 0) {
            for (const pos of shortPositions) {
                const exitOrder: PlaceOrderRequest = {
                    symbol: pos.symbol,
                    exchange: pos.exchange,
                    action: 'BUY',
                    type: 'MARKET',
                    product: pos.product,
                    quantity: Math.abs(pos.netQuantity)
                };
                console.log(`[OrderManager] Exiting SELL (short) position for ${pos.symbol}`);
                const orderId = await this.placeOrder(broker, exitOrder, credentials);
                results.push(`Exited Short ${pos.symbol}: ${orderId}`);
            }
        }

        if (shortPositions.length > 0 && longPositions.length > 0) {
            console.log(`[OrderManager] Waiting for 2 seconds before exiting BUY orders...`);
            await delay(2000);
        }

        if (longPositions.length > 0) {
            for (const pos of longPositions) {
                const exitOrder: PlaceOrderRequest = {
                    symbol: pos.symbol,
                    exchange: pos.exchange,
                    action: 'SELL',
                    type: 'MARKET',
                    product: pos.product,
                    quantity: pos.netQuantity
                };
                console.log(`[OrderManager] Exiting BUY (long) position for ${pos.symbol}`);
                const orderId = await this.placeOrder(broker, exitOrder, credentials);
                results.push(`Exited Long ${pos.symbol}: ${orderId}`);
            }
        }

        return { message: "Exit all completed", results };
    }
}
