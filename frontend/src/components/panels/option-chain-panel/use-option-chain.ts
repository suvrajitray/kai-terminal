import { useState, useEffect, useRef, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { fetchOptionChain, fetchIvHistory } from "@/services/trading-api";
import { API_BASE_URL } from "@/lib/constants";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import type { OptionChainEntry, IvSnapshot } from "@/types";

const LIVE_WINDOW_SIZE = 20; // OTM rows on each side of ATM (for SignalR subscriptions)
const VISIBLE_SIDE = 20;    // OTM rows shown on each side of ATM initially
const VISIBLE_STEP = 15;    // extra rows revealed per "load more" (each side)

export function useOptionChain() {
  const getExpiries = useOptionContractsStore((s) => s.getExpiries);

  const [underlying, setUnderlying] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  const [allChain, setAllChain] = useState<OptionChainEntry[]>([]);
  const [liveStrikeSet, setLiveStrikeSet] = useState<Set<number>>(new Set());
  const [atmStrike, setAtmStrike] = useState<number>(0);
  const [spotPrice, setSpotPrice] = useState<number>(0);
  const [visibleLow, setVisibleLow]   = useState(VISIBLE_SIDE); // strikes below ATM
  const [visibleHigh, setVisibleHigh] = useState(VISIBLE_SIDE); // strikes above ATM
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [ivHistory, setIvHistory] = useState<IvSnapshot[]>([]);
  const [scrollSignal, setScrollSignal] = useState(0);

  const connectionRef  = useRef<signalR.HubConnection | null>(null);
  const liveTokensRef  = useRef<string[]>([]);
  const ivHistoryCache = useRef<Record<string, IvSnapshot[]>>({});

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

  const fetchAndSubscribe = useCallback(async (u: string, exp: string, scrollAtm = false) => {
    const underlyingKey = UNDERLYING_KEYS[u];
    if (!underlyingKey || !exp) return;
    setLoading(true);
    try {
      const chain = await fetchOptionChain(underlyingKey, exp);
      const sorted = [...chain].sort((a, b) => a.strikePrice - b.strikePrice);
      const { liveSet, atm, spot } = buildLiveWindow(sorted);
      setAllChain(sorted);
      setLiveStrikeSet(liveSet);
      setAtmStrike(atm);
      setSpotPrice(spot);
      setLastRefreshed(new Date());
      setVisibleLow(VISIBLE_SIDE);
      setVisibleHigh(VISIBLE_SIDE);
      subscribeLiveTokens(sorted, liveSet);
      if (scrollAtm) setScrollSignal((s) => s + 1);
    } finally {
      setLoading(false);
    }
  }, [buildLiveWindow, subscribeLiveTokens]);

  const refresh = useCallback(() => {
    if (underlying && expiry) fetchAndSubscribe(underlying, expiry, true);
  }, [underlying, expiry, fetchAndSubscribe]);

  // Auto-refresh Greeks (delta, IV) every 60s — LTP streams via SignalR but greeks don't
  // scrollAtm=false so the user's scroll position is preserved during background refresh
  useEffect(() => {
    if (!underlying || !expiry) return;
    const id = setInterval(() => fetchAndSubscribe(underlying, expiry, false), 60_000);
    return () => clearInterval(id);
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

  // Fetch chain when underlying/expiry changes — always scroll to ATM on these triggers
  useEffect(() => {
    if (underlying && expiry) fetchAndSubscribe(underlying, expiry, true);
  }, [underlying, expiry, fetchAndSubscribe]);

  // Fetch IV history when underlying changes (cached — doesn't need expiry)
  useEffect(() => {
    if (!underlying) return;
    const cached = ivHistoryCache.current[underlying];
    if (cached) { setIvHistory(cached); return; }
    fetchIvHistory(underlying)
      .then((data) => {
        ivHistoryCache.current[underlying] = data;
        setIvHistory(data);
      })
      .catch(() => {});
  }, [underlying]);

  // ATM IV + Expected Move — computed from ATM straddle price
  const atmEntry    = atmStrike > 0 ? allChain.find((e) => e.strikePrice === atmStrike) : undefined;
  const callIv      = atmEntry?.callOptions?.optionGreeks?.iv ?? 0;
  const putIv       = atmEntry?.putOptions?.optionGreeks?.iv  ?? 0;
  const atmIv       = callIv > 0 && putIv > 0 ? (callIv + putIv) / 2
                    : callIv > 0 ? callIv
                    : putIv  > 0 ? putIv
                    : null;
  const atmCallLtp  = atmEntry?.callOptions?.marketData?.ltp ?? 0;
  const atmPutLtp   = atmEntry?.putOptions?.marketData?.ltp  ?? 0;
  const straddlePremium  = atmCallLtp > 0 && atmPutLtp > 0 ? atmCallLtp + atmPutLtp : 0;
  const expectedMovePct  = spotPrice > 0 && straddlePremium > 0 ? (straddlePremium / spotPrice) * 100 : null;
  const expectedMovePts  = straddlePremium > 0 ? straddlePremium : null;

  // Max Pain — strike that minimises total in-the-money payout from option writers
  const maxPain = (() => {
    if (allChain.length === 0) return null;
    let minPain = Infinity;
    let mpStrike = 0;
    for (const row of allChain) {
      const S = row.strikePrice;
      let pain = 0;
      for (const r of allChain) {
        const K = r.strikePrice;
        const callOi = r.callOptions?.marketData?.oi ?? 0;
        const putOi  = r.putOptions?.marketData?.oi  ?? 0;
        if (K <= S) pain += (S - K) * callOi;
        if (K >= S) pain += (K - S) * putOi;
      }
      if (pain < minPain) { minPain = pain; mpStrike = S; }
    }
    return mpStrike > 0 ? mpStrike : null;
  })();

  // Slice ATM ± visibleLow/High rows independently
  const atmIdx = allChain.findIndex((e) => e.strikePrice === atmStrike);
  const sliceStart = atmIdx >= 0 ? Math.max(0, atmIdx - visibleLow)  : 0;
  const sliceEnd   = atmIdx >= 0 ? Math.min(allChain.length, atmIdx + visibleHigh + 1) : allChain.length;
  const visibleRows    = allChain.slice(sliceStart, sliceEnd);
  const hasMoreLow  = sliceStart > 0;
  const hasMoreHigh = sliceEnd < allChain.length;

  const loadMoreLow  = useCallback(() => setVisibleLow((s)  => s + VISIBLE_STEP), []);
  const loadMoreHigh = useCallback(() => setVisibleHigh((s) => s + VISIBLE_STEP), []);

  // Compute PCR from total OI across all strikes (more reliable than Upstox's per-row pcr field)
  const pcr = (() => {
    const totalCallOi = allChain.reduce((s, e) => s + (e.callOptions?.marketData?.oi ?? 0), 0);
    const totalPutOi  = allChain.reduce((s, e) => s + (e.putOptions?.marketData?.oi  ?? 0), 0);
    return totalCallOi > 0 ? totalPutOi / totalCallOi : null;
  })();

  // IV Rank + IV Percentile from historical snapshots
  const ivHistoryDays = ivHistory.length;
  const { ivRank, ivPercentile } = (() => {
    if (ivHistoryDays < 2 || atmIv === null) return { ivRank: null, ivPercentile: null };
    const ivs = ivHistory.map((s) => s.atmIv);
    const lo  = Math.min(...ivs);
    const hi  = Math.max(...ivs);
    const ivRank      = hi > lo ? ((atmIv - lo) / (hi - lo)) * 100 : null;
    const ivPercentile = (ivs.filter((v) => v < atmIv).length / ivs.length) * 100;
    return { ivRank, ivPercentile };
  })();

  return {
    underlying, setUnderlying,
    expiry, setExpiry,
    expiries,
    visibleRows,
    hasMoreLow,
    hasMoreHigh,
    loadMoreLow,
    loadMoreHigh,
    liveStrikeSet,
    atmStrike,
    spotPrice,
    pcr,
    atmIv,
    maxPain,
    expectedMovePct,
    expectedMovePts,
    ivRank,
    ivPercentile,
    ivHistoryDays,
    loading,
    lastRefreshed,
    refresh,
    scrollSignal,
  };
}
