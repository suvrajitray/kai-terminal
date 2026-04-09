import { Router } from 'express';
import { placeZerodhaOrder, exitZerodhaPosition, exitAllZerodha } from '../controllers/zerodha.controller';
import { placeUpstoxOrder, exitUpstoxPosition, exitAllUpstox } from '../controllers/upstox.controller';

const router = Router();

// Zerodha routes
router.post('/zerodha/order', placeZerodhaOrder);
router.post('/zerodha/exit', exitZerodhaPosition);
router.post('/zerodha/exit-all', exitAllZerodha);

// Upstox routes
router.post('/upstox/order', placeUpstoxOrder);
router.post('/upstox/exit', exitUpstoxPosition);
router.post('/upstox/exit-all', exitAllUpstox);

export default router;
