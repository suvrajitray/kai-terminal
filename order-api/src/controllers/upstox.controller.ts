import { Request, Response } from 'express';
import { OrderManagerService } from '../services/order-manager.service';
import { PlaceOrderRequest } from '../models/common.types';

const orderManager = new OrderManagerService();

const extractCredentials = (req: Request) => {
    return {
        accessToken: (req.headers['x-upstox-token'] as string) || (req.headers['authorization']?.replace('Bearer ', ''))
    };
};

export const placeUpstoxOrder = async (req: Request, res: Response) => {
    try {
        const order: PlaceOrderRequest = req.body;
        const credentials = extractCredentials(req);
        if (!credentials.accessToken) throw new Error("Missing Upstox access token header");

        const orderId = await orderManager.placeOrder('UPSTOX', order, credentials as any);
        res.status(200).json({ success: true, orderId });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const exitUpstoxPosition = async (req: Request, res: Response) => {
    try {
        const order: PlaceOrderRequest = req.body;
        const credentials = extractCredentials(req);
        if (!credentials.accessToken) throw new Error("Missing Upstox access token header");
        
        const orderId = await orderManager.exitPosition('UPSTOX', order, credentials as any);
        res.status(200).json({ success: true, orderId });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const exitAllUpstox = async (req: Request, res: Response) => {
    try {
        const credentials = extractCredentials(req);
        if (!credentials.accessToken) throw new Error("Missing Upstox access token header");

        const result = await orderManager.exitAll('UPSTOX', credentials as any);
        res.status(200).json({ success: true, ...result });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};
