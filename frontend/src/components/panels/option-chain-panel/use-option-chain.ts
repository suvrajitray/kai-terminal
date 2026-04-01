import { useState, useEffect, useRef, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { fetchOptionChain } from "@/services/trading-api";
import { API_BASE_URL } from "@/lib/constants";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import type { OptionChainEntry } from "@/types";

const LIVE_WINDOW_SIZE = 20; // OTM rows on each side of ATM

export function useOptionChain() {
  const getExpiries = useOptionContractsStore((s) => s.getExpiries);

  const [underlying, setUnderlying] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  const [allChain, setAllChain] = useState<OptionChainEntry[]>([]);
  const [liveStrikeSet, setLiveStrikeSet] = useState<Set<number>>(new Set());
  const [atmStrike, setAtmStrike] = useState<number>(0);
  const [spotPrice, setSpotPrice] = useState<number>(0);
  const [showExtra, setShowExtra] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const liveTokensRef = useRef<string[]>([]);

  const expiries = getExpiries(underlying);

  // Default expiry to the nearest one when underlying changes
  useEffect(() => {
    setExpiry((prev) => {
      if (expiries.length > 0 && !expiries.includes(prev)) return expiries[0];
      return prev;
    });
  }, [underlying, expiries]);

  const buildLiveWindow = useCallback((chain: OptionChainEntry[]) => {
    if (chain.length === 0) return { liveSet: new Set<number>(), atm: 0, spot: 0 };
    const spot = chain[0].underlyingSpotPrice;
    const atmEntry = chain.reduce((best, e) =>
      Math.abs(e.strikePrice - spot) < Math.abs(best.strikePrice - spot) ? e : best,
    );
    const atmIdx = chain.findIndex((e) => e.strikePrice === atmEntry.strikePrice);
    const start = Math.max(0, atmIdx - LIVE_WINDOW_SIZE);
    const end = Math.min(chain.length - 1, atmIdx + LIVE_WINDOW_SIZE);
    const liveSet = new Set(chain.slice(start, end + 1).map((e) => e.strikePrice));
    return { liveSet, atm: atmEntry.strikePrice, spot };
  }, []);

  const subscribeLiveTokens = useCallback((chain: OptionChainEntry[], liveSet: Set<number>) => {
    const conn = connectionRef.current;
    if (conn?.state !== signalR.HubConnectionState.Connected) return;
    const tokens: string[] = [];
    for (const entry of chain) {
      if (!liveSet.has(entry.strikePrice)) continue;
      if (entry.callOptions?.instrumentKey) tokens.push(entry.callOptions.instrumentKey);
      if (entry.putOptions?.instrumentKey) tokens.push(entry.putOptions.instrumentKey);
    }
    liveTokensRef.current = tokens;
    conn.invoke("ClearSubscriptions").catch(() => {});
    if (tokens.length > 0) conn.invoke("SubscribeToInstruments", tokens).catch(() => {});
  }, []);

  const fetchAndSubscribe = useCallback(async (u: string, exp: string) => {
    const underlyingKey = UNDERLYING_KEYS[u];
    if (!underlyingKey || !exp) return;
    setLoading(true);
    try {
      const chain = await fetchOptionChain(underlyingKey, exp);
      const sorted = [...chain].sort((a, b) => b.strikePrice - a.strikePrice);
      const { liveSet, atm, spot } = buildLiveWindow(sorted);
      setAllChain(sorted);
      setLiveStrikeSet(liveSet);
      setAtmStrike(atm);
      setSpotPrice(spot);
      setLastRefreshed(new Date());
      setShowExtra(false);
      subscribeLiveTokens(sorted, liveSet);
    } finally {
      setLoading(false);
    }
  }, [buildLiveWindow, subscribeLiveTokens]);

  const refresh = useCallback(() => {
    if (underlying && expiry) fetchAndSubscribe(underlying, expiry);
  }, [underlying, expiry, fetchAndSubscribe]);

  // SignalR connection — one per panel mount, dedicated option-chain hub
  useEffect(() => {
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/option-chain`)
      .withAutomaticReconnect()
      .build();

    conn.on("ReceiveLtpBatch", (updates: Array<{ instrumentToken: string; ltp: number }>) => {
      const map = new Map(updates.map((u) => [u.instrumentToken, u.ltp]));
      setAllChain((prev) => {
        if (prev.length === 0 || map.size === 0) return prev;
        let changed = false;
        const next = prev.map((entry) => {
          let callOpts = entry.callOptions;
          let putOpts = entry.putOptions;
          if (callOpts?.marketData && map.has(callOpts.instrumentKey)) {
            callOpts = { ...callOpts, marketData: { ...callOpts.marketData, ltp: map.get(callOpts.instrumentKey)! } };
            changed = true;
          }
          if (putOpts?.marketData && map.has(putOpts.instrumentKey)) {
            putOpts = { ...putOpts, marketData: { ...putOpts.marketData, ltp: map.get(putOpts.instrumentKey)! } };
            changed = true;
          }
          if (callOpts === entry.callOptions && putOpts === entry.putOptions) return entry;
          return { ...entry, callOptions: callOpts, putOptions: putOpts };
        });
        return changed ? next : prev;
      });
    });

    // On reconnect, re-subscribe live tokens
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch chain when underlying/expiry changes
  useEffect(() => {
    if (underlying && expiry) fetchAndSubscribe(underlying, expiry);
  }, [underlying, expiry, fetchAndSubscribe]);

  const liveRows = allChain.filter((e) => liveStrikeSet.has(e.strikePrice));
  const extraRows = allChain.filter((e) => !liveStrikeSet.has(e.strikePrice));
  const visibleRows = showExtra ? allChain : liveRows;

  // Overall PCR from the first entry (same across all entries)
  const pcr = allChain[0]?.pcr ?? null;

  return {
    underlying, setUnderlying,
    expiry, setExpiry,
    expiries,
    visibleRows,
    extraRows,
    liveStrikeSet,
    atmStrike,
    spotPrice,
    pcr,
    showExtra, setShowExtra,
    loading,
    lastRefreshed,
    refresh,
  };
}
