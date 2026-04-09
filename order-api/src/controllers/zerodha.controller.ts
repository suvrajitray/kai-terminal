import { Request, Response } from 'express';
import { OrderManagerService } from '../services/order-manager.service';
import { PlaceOrderRequest } from '../models/common.types';

const orderManager = new OrderManagerService();

const extractCredentials = (req: Request) => {
    return {
        apiKey: req.headers['x-zerodha-apikey'] as string,
        accessToken: req.headers['x-zerodha-token'] as string
    };
};

export const placeZerodhaOrder = async (req: Request, res: Response) => {
    try {
        const order: PlaceOrderRequest = req.body;
        const credentials = extractCredentials(req);
        
        if (!credentials.accessToken || !credentials.apiKey) throw new Error("Missing Zerodha credentials headers");

        const orderId = await orderManager.placeOrder('ZERODHA', order, credentials);
        res.status(200).json({ success: true, orderId });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const exitZerodhaPosition = async (req: Request, res: Response) => {
    try {
        const order: PlaceOrderRequest = req.body;
        const credentials = extractCredentials(req);
        
        if (!credentials.accessToken || !credentials.apiKey) throw new Error("Missing Zerodha credentials headers");
        
        const orderId = await orderManager.exitPosition('ZERODHA', order, credentials);
        res.status(200).json({ success: true, orderId });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const exitAllZerodha = async (req: Request, res: Response) => {
    try {
        const credentials = extractCredentials(req);
        if (!credentials.accessToken || !credentials.apiKey) throw new Error("Missing Zerodha credentials headers");

        const result = await orderManager.exitAll('ZERODHA', credentials);
        res.status(200).json({ success: true, ...result });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};
