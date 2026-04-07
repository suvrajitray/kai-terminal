import { useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { toast } from "@/lib/toast";
import { fetchPositions, fetchZerodhaPositions } from "@/services/trading-api";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { API_BASE_URL } from "@/lib/constants";
import { useBrokerStore } from "@/stores/broker-store";
import { useAuthStore } from "@/stores/auth-store";
import type { Position } from "@/types";

export function usePositionsFeed(onOrderUpdate?: () => void) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  /** Fallback: REST fetch when SignalR is unavailable. */
  const load = useCallback(async (exchanges?: string[]) => {
    setLoading(true);
    try {
      const { getCredentials } = useBrokerStore.getState();
      const upstoxToken = getCredentials("upstox")?.accessToken;
      const zerodhaToken = getCredentials("zerodha")?.accessToken;
      const hasUpstox = !!upstoxToken && !isBrokerTokenExpired("upstox", upstoxToken);
      const hasZerodha = !isBrokerTokenExpired("zerodha", zerodhaToken) && !!zerodhaToken;

      const [upstox, zerodha] = await Promise.all([
        hasUpstox  ? fetchPositions(exchanges)        : Promise.resolve([] as Position[]),
        hasZerodha ? fetchZerodhaPositions(exchanges) : Promise.resolve([] as Position[]),
      ]);
      setPositions([...upstox, ...zerodha]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { getCredentials } = useBrokerStore.getState();
    const upstoxToken  = getCredentials("upstox")?.accessToken;
    const zerodhaToken = getCredentials("zerodha")?.accessToken;
    const zerodhaApiKey = getCredentials("zerodha")?.apiKey;

    const hasUpstox  = !!upstoxToken  && !isBrokerTokenExpired("upstox",  upstoxToken);
    const hasZerodha = !!zerodhaToken && !isBrokerTokenExpired("zerodha", zerodhaToken) && !!zerodhaApiKey;

    if (!hasUpstox && !hasZerodha) {
      // No broker available — nothing to connect
      return;
    }

    const params = new URLSearchParams();
    if (hasUpstox)  params.set("upstoxToken",  upstoxToken!);
    if (hasZerodha) { params.set("zerodhaToken", zerodhaToken!); params.set("zerodhaApiKey", zerodhaApiKey!); }

    const wsUrl = `${API_BASE_URL}/hubs/positions?${params.toString()}`;
    const jwt   = useAuthStore.getState().token ?? "";

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(wsUrl, { accessTokenFactory: () => jwt })
      .withAutomaticReconnect()
      .build();

    // Backend sends combined positions for all connected brokers
    conn.on("ReceivePositions", (incoming: Position[]) => {
      setPositions(incoming);
      setLoading(false);
    });

    conn.on("ReceiveLtpBatch", (updates: Array<{ instrumentToken: string; ltp: number }>) => {
      setPositions((prev) => {
        if (prev.length === 0) return prev;
        const map = new Map(updates.map((u) => [u.instrumentToken, u.ltp]));
        return prev.map((p) => {
          const ltp = map.get(p.instrumentToken);
          if (ltp === undefined) return p;
          const pnl = p.pnl + p.quantity * (ltp - p.ltp);
          return { ...p, ltp, pnl };
        });
      });
    });

    conn.on("ReceiveOrderUpdate", (update: {
      orderId: string;
      status: string;
      statusMessage: string;
      tradingSymbol: string;
    }) => {
      const s = update.status.toLowerCase();
      if (s === "rejected") {
        toast.error(
          update.statusMessage
            ? `Order rejected: ${update.tradingSymbol} — ${update.statusMessage}`
            : `Order rejected: ${update.tradingSymbol}`
        );
      } else if (s === "complete") {
        toast.success(`Order filled: ${update.tradingSymbol}`);
        load();   // refresh positions immediately on fill
      }
      onOrderUpdate?.();
    });

    conn.onreconnecting(() => setIsLive(false));
    conn.onreconnected(() => setIsLive(true));
    conn.onclose(() => setIsLive(false));

    setLoading(true);
    conn.start()
      .then(() => setIsLive(true))
      .catch(() => {
        setIsLive(false);
        load().catch(() => {});
      });

    connectionRef.current = conn;
    return () => {
      conn.stop();
      connectionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { positions, setPositions, loading, isLive, load };
}
