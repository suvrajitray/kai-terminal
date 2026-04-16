import { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '../stores/auth-store';
import { useBrokerStore } from '../stores/broker-store';
import { API_BASE_URL } from '../constants';

export interface LivePosition {
  instrumentToken: string;
  tradingSymbol: string;
  product: string;
  broker: string;
  quantity: number;
  ltp: number;
  averagePrice: number;
  pnl: number;
  realised: number;
  unrealised: number;
}

export function useLivePositions() {
  const token = useAuthStore((s) => s.token);
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [connected, setConnected] = useState(false);
  const connRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    if (!token) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/positions`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .build();

    conn.on('ReceivePositions', (data: LivePosition[]) => {
      setPositions(data);
      // Auto-detect and mark authenticated brokers from live position data
      const uniqueBrokers = [...new Set(data.map((p: LivePosition) => p.broker ?? 'upstox'))];
      const { setAuthenticated } = useBrokerStore.getState();
      uniqueBrokers.forEach((b) => setAuthenticated(b, true));
    });

    conn.on('ReceiveLtpBatch', (batch: Record<string, number>) => {
      setPositions((prev) =>
        prev.map((p) => {
          const ltp = batch[p.instrumentToken] ?? p.ltp;
          const pnl = p.realised + p.quantity * (ltp - p.averagePrice);
          return { ...p, ltp, pnl };
        })
      );
    });

    conn.onclose(() => setConnected(false));
    conn.onreconnected(() => setConnected(true));
    conn.start().then(() => setConnected(true)).catch(console.error);

    connRef.current = conn;
    return () => { conn.stop(); };
  }, [token]);

  return { positions, connected };
}
