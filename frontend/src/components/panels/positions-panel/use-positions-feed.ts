import { useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { toast } from "sonner";
import { fetchPositions } from "@/services/trading-api";
import { API_BASE_URL } from "@/lib/constants";
import { useBrokerStore } from "@/stores/broker-store";
import type { Position } from "@/types";

export function usePositionsFeed(onOrderUpdate?: () => void) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const load = useCallback(async (exchanges = ["NFO", "BFO"]) => {
    setLoading(true);
    try {
      setPositions(await fetchPositions(exchanges));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const upstoxToken = useBrokerStore.getState().getCredentials("upstox")?.accessToken;
    if (!upstoxToken) {
      load(["NFO", "BFO"]).catch(() => {});
      return;
    }

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/positions?upstoxToken=${encodeURIComponent(upstoxToken)}&exchange=NFO,BFO`)
      .withAutomaticReconnect()
      .build();

    conn.on("ReceivePositions", (incoming: Position[]) => {
      setPositions(incoming);
      setLoading(false);
    });

    conn.on("ReceiveLtpBatch", (updates: Array<{ instrumentToken: string; ltp: number }>) => {
      setPositions((prev) => {
        if (prev.length === 0) return prev;
        const map = new Map(updates.map((u) => [u.instrumentToken, u.ltp]));
        return prev.map((p) => {
          const ltp = map.get(p.instrument_token);
          if (ltp === undefined) return p;
          const avgPrice = p.average_price !== 0 ? p.average_price : p.quantity < 0 ? p.sell_price : p.buy_price;
          const unrealised = p.quantity * (ltp - avgPrice);
          return { ...p, last_price: ltp, unrealised, pnl: unrealised + p.realised };
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
        load(["NFO", "BFO"]).catch(() => {});
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
