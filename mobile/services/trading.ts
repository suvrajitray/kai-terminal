import { apiClient } from './api';

export async function exitPosition(instrumentToken: string, product: string, broker: string) {
  if (broker === 'zerodha') {
    await apiClient.post(`/api/zerodha/positions/${encodeURIComponent(instrumentToken)}/exit`);
  } else {
    const p = product === 'Delivery' ? 'D' : 'I';
    await apiClient.post(`/api/upstox/positions/${encodeURIComponent(instrumentToken)}/exit`, null, {
      params: { product: p },
    });
  }
}

export async function exitAll(brokers: string[]) {
  await Promise.all(brokers.map((b) =>
    b === 'zerodha'
      ? apiClient.post('/api/zerodha/positions/exit-all')
      : apiClient.post('/api/upstox/positions/exit-all')
  ));
}

export async function exitByFilter(
  positions: { instrumentToken: string; product: string; broker: string; pnl: number }[],
  filter: 'profitable' | 'loss'
) {
  const toExit = positions.filter((p) => filter === 'profitable' ? p.pnl > 0 : p.pnl < 0);
  await Promise.all(toExit.map((p) => exitPosition(p.instrumentToken, p.product, p.broker)));
}

export async function placeOrderByPrice(broker: string, payload: {
  underlyingKey: string; expiry: string; instrumentType: string;
  targetPremium: number; qty: number; transactionType: 'Buy' | 'Sell'; product: string;
}) {
  await apiClient.post(`/api/${broker}/orders/by-price`, payload);
}

export async function fetchFunds(broker: string): Promise<{ availableMargin: number | null }> {
  const res = await apiClient.get<{ availableMargin: number | null }>(`/api/${broker}/funds`);
  return res.data;
}
