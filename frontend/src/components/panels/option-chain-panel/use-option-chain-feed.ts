import { useEffect, useRef, useCallback, useEffectEvent } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL } from "@/lib/constants";

interface UseOptionChainFeedOptions {
  onLtpBatch: (updates: Array<{ instrumentToken: string; ltp: number }>) => void;
}

export function useOptionChainFeed({ onLtpBatch }: UseOptionChainFeedOptions) {
  const connectionRef  = useRef<signalR.HubConnection | null>(null);
  const liveTokensRef  = useRef<string[]>([]);
  const handleLtpBatch = useEffectEvent((updates: Array<{ instrumentToken: string; ltp: number }>) => {
    onLtpBatch(updates);
  });

  const setLiveTokens = useCallback((tokens: string[]) => {
    liveTokensRef.current = tokens;
  }, []);

  const invokeSubscribe = useCallback((tokens: string[]) => {
    const conn = connectionRef.current;
    if (conn?.state !== signalR.HubConnectionState.Connected) return;
    conn.invoke("ClearSubscriptions").catch(() => {});
    if (tokens.length > 0) conn.invoke("SubscribeToInstruments", tokens).catch(() => {});
  }, []);

  useEffect(() => {
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/option-chain`)
      .withAutomaticReconnect()
      .build();

    conn.on("ReceiveLtpBatch", handleLtpBatch);

    conn.onreconnected(() => {
      const tokens = liveTokensRef.current;
      if (tokens.length > 0) conn.invoke("SubscribeToInstruments", tokens).catch(() => {});
    });

    connectionRef.current = conn;
    conn.start().catch(() => {});

    return () => {
      conn.invoke("ClearSubscriptions").catch(() => {});
      conn.stop();
      connectionRef.current = null;
    };
  }, []);

  return { setLiveTokens, invokeSubscribe };
}
