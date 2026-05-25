import { useReducer, useEffect, useCallback } from "react";
import { fetchOptionChain } from "@/services/trading-api";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { UNDERLYING_KEYS } from "@/lib/shift-config";
import { UNDERLYING_TO_INDEX } from "@/lib/constants";
import { useIvHistory } from "./use-iv-history";
import { useOptionChainFeed } from "./use-option-chain-feed";
import { useIndicesFeed } from "@/hooks/use-indices-feed";
import { calculateMaxPain, calculatePcr, calculateAtmIv, calculateExpectedMove, calculateIvRankMetrics } from "./chain-analytics";
import { useBasketStore } from "@/stores/basket-store";
import type { OptionChainEntry } from "@/types";

const LIVE_WINDOW_SIZE = 20;
const VISIBLE_SIDE = 20;
const VISIBLE_STEP = 15;

interface ChainState {
  underlying: string;
  expiry: string;
  allChain: OptionChainEntry[];
  liveStrikeSet: Set<number>;
  atmStrike: number;
  spotPrice: number;
  visibleLow: number;
  visibleHigh: number;
  loading: boolean;
  lastRefreshed: Date | null;
  scrollSignal: number;
}

type ChainAction =
  | { type: "SET_UNDERLYING"; underlying: string }
  | { type: "SET_EXPIRY"; expiry: string }
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; chain: OptionChainEntry[]; liveSet: Set<number>; atm: number; spot: number; scrollAtm: boolean }
  | { type: "FETCH_ERROR" }
  | { type: "UPDATE_SPOT"; spot: number }
  | { type: "UPDATE_LTP_BATCH"; map: Map<string, number> }
  | { type: "LOAD_MORE_LOW" }
  | { type: "LOAD_MORE_HIGH" };

const initialState: ChainState = {
  underlying: "NIFTY",
  expiry: "",
  allChain: [],
  liveStrikeSet: new Set(),
  atmStrike: 0,
  spotPrice: 0,
  visibleLow: VISIBLE_SIDE,
  visibleHigh: VISIBLE_SIDE,
  loading: false,
  lastRefreshed: null,
  scrollSignal: 0,
};

function chainReducer(state: ChainState, action: ChainAction): ChainState {
  switch (action.type) {
    case "SET_UNDERLYING":
      return { ...state, underlying: action.underlying };
    case "SET_EXPIRY":
      return { ...state, expiry: action.expiry };
    case "FETCH_START":
      return { ...state, loading: true };
    case "FETCH_SUCCESS":
      return {
        ...state,
        loading: false,
        allChain: action.chain,
        liveStrikeSet: action.liveSet,
        atmStrike: action.atm,
        spotPrice: action.spot,
        lastRefreshed: new Date(),
        visibleLow: VISIBLE_SIDE,
        visibleHigh: VISIBLE_SIDE,
        scrollSignal: action.scrollAtm ? state.scrollSignal + 1 : state.scrollSignal,
      };
    case "FETCH_ERROR":
      return { ...state, loading: false };
    case "UPDATE_SPOT":
      return { ...state, spotPrice: action.spot };
    case "UPDATE_LTP_BATCH": {
      if (state.allChain.length === 0 || action.map.size === 0) return state;
      let changed = false;
      const next = state.allChain.map((entry) => {
        let callOpts = entry.callOptions;
        let putOpts  = entry.putOptions;
        if (callOpts?.marketData && action.map.has(callOpts.instrumentKey)) {
          callOpts = { ...callOpts, marketData: { ...callOpts.marketData, ltp: action.map.get(callOpts.instrumentKey)! } };
          changed = true;
        }
        if (putOpts?.marketData && action.map.has(putOpts.instrumentKey)) {
          putOpts = { ...putOpts, marketData: { ...putOpts.marketData, ltp: action.map.get(putOpts.instrumentKey)! } };
          changed = true;
        }
        if (callOpts === entry.callOptions && putOpts === entry.putOptions) return entry;
        return { ...entry, callOptions: callOpts, putOptions: putOpts };
      });
      return changed ? { ...state, allChain: next } : state;
    }
    case "LOAD_MORE_LOW":
      return { ...state, visibleLow: state.visibleLow + VISIBLE_STEP };
    case "LOAD_MORE_HIGH":
      return { ...state, visibleHigh: state.visibleHigh + VISIBLE_STEP };
    default:
      return state;
  }
}

export function useOptionChain() {
  const [state, dispatch] = useReducer(chainReducer, initialState);
  const { underlying, expiry, allChain, liveStrikeSet, atmStrike, spotPrice,
          visibleLow, visibleHigh, loading, lastRefreshed, scrollSignal } = state;

  const getExpiries = useOptionContractsStore((s) => s.getExpiries);
  const expiries = getExpiries(underlying);
  const ivHistory = useIvHistory(underlying);

  // Keep spot price live from the indices SignalR feed
  const indexPrices = useIndicesFeed();
  useEffect(() => {
    const key = UNDERLYING_TO_INDEX[underlying];
    if (!key) return;
    const ltp = indexPrices[key]?.ltp;
    if (ltp != null && ltp > 0) dispatch({ type: "UPDATE_SPOT", spot: ltp });
  }, [indexPrices, underlying]);

  const handleLtpBatch = useCallback((updates: Array<{ instrumentToken: string; ltp: number }>) => {
    const map = new Map(updates.map((u) => [u.instrumentToken, u.ltp]));
    dispatch({ type: "UPDATE_LTP_BATCH", map });
    useBasketStore.getState().updateLtpBatch(updates);
  }, []);

  const { setLiveTokens, invokeSubscribe } = useOptionChainFeed({ onLtpBatch: handleLtpBatch });

  // Default expiry to the nearest one when underlying changes
  useEffect(() => {
    if (expiries.length > 0 && !expiries.includes(expiry)) {
      dispatch({ type: "SET_EXPIRY", expiry: expiries[0] });
    }
  }, [underlying, expiries]); // intentionally excludes expiry to avoid loop

  const buildLiveWindow = useCallback((chain: OptionChainEntry[]) => {
    if (chain.length === 0) return { liveSet: new Set<number>(), atm: 0, spot: 0 };
    const spot = chain[0].underlyingSpotPrice;
    const atmEntry = chain.reduce((best, e) =>
      Math.abs(e.strikePrice - spot) < Math.abs(best.strikePrice - spot) ? e : best,
    );
    const atmIdx = chain.findIndex((e) => e.strikePrice === atmEntry.strikePrice);
    const start = Math.max(0, atmIdx - LIVE_WINDOW_SIZE);
    const end   = Math.min(chain.length - 1, atmIdx + LIVE_WINDOW_SIZE);
    const liveSet = new Set(chain.slice(start, end + 1).map((e) => e.strikePrice));
    return { liveSet, atm: atmEntry.strikePrice, spot };
  }, []);

  const subscribeLiveTokens = useCallback((chain: OptionChainEntry[], liveSet: Set<number>) => {
    const tokens: string[] = [];
    for (const entry of chain) {
      if (!liveSet.has(entry.strikePrice)) continue;
      if (entry.callOptions?.instrumentKey) tokens.push(entry.callOptions.instrumentKey);
      if (entry.putOptions?.instrumentKey)  tokens.push(entry.putOptions.instrumentKey);
    }
    setLiveTokens(tokens);
    invokeSubscribe(tokens);
  }, [setLiveTokens, invokeSubscribe]);

  const fetchAndSubscribe = useCallback(async (u: string, exp: string, scrollAtm = false) => {
    const underlyingKey = UNDERLYING_KEYS[u];
    if (!underlyingKey || !exp) return;
    dispatch({ type: "FETCH_START" });
    try {
      const chain  = await fetchOptionChain(underlyingKey, exp);
      const sorted = [...chain].sort((a, b) => a.strikePrice - b.strikePrice);
      const { liveSet, atm, spot } = buildLiveWindow(sorted);
      dispatch({ type: "FETCH_SUCCESS", chain: sorted, liveSet, atm, spot, scrollAtm });
      subscribeLiveTokens(sorted, liveSet);
    } catch {
      dispatch({ type: "FETCH_ERROR" });
    }
  }, [buildLiveWindow, subscribeLiveTokens]);

  const refresh = useCallback(() => {
    if (underlying && expiry) fetchAndSubscribe(underlying, expiry, true);
  }, [underlying, expiry, fetchAndSubscribe]);

  // Auto-refresh Greeks every 60s (LTP streams live, but Greeks don't)
  useEffect(() => {
    if (!underlying || !expiry) return;
    const id = setInterval(() => fetchAndSubscribe(underlying, expiry, false), 60_000);
    return () => clearInterval(id);
  }, [underlying, expiry, fetchAndSubscribe]);

  // Fetch chain when underlying/expiry changes
  useEffect(() => {
    if (underlying && expiry) fetchAndSubscribe(underlying, expiry, true);
  }, [underlying, expiry, fetchAndSubscribe]);

  const atmIv = calculateAtmIv(allChain, atmStrike);
  const { pct: expectedMovePct, pts: expectedMovePts } = calculateExpectedMove(allChain, atmStrike, spotPrice);
  const maxPain = calculateMaxPain(allChain);
  const pcr     = calculatePcr(allChain);
  const { ivRank, ivPercentile } = calculateIvRankMetrics(atmIv, ivHistory);

  const atmIdx   = allChain.findIndex((e) => e.strikePrice === atmStrike);
  const sliceStart = atmIdx >= 0 ? Math.max(0, atmIdx - visibleLow)              : 0;
  const sliceEnd   = atmIdx >= 0 ? Math.min(allChain.length, atmIdx + visibleHigh + 1) : allChain.length;
  const visibleRows = allChain.slice(sliceStart, sliceEnd);
  const hasMoreLow  = sliceStart > 0;
  const hasMoreHigh = sliceEnd < allChain.length;

  return {
    underlying,
    setUnderlying: useCallback((u: string) => dispatch({ type: "SET_UNDERLYING", underlying: u }), []),
    expiry,
    setExpiry: useCallback((e: string) => dispatch({ type: "SET_EXPIRY", expiry: e }), []),
    expiries,
    allChain,
    visibleRows,
    hasMoreLow,
    hasMoreHigh,
    loadMoreLow:  useCallback(() => dispatch({ type: "LOAD_MORE_LOW" }),  []),
    loadMoreHigh: useCallback(() => dispatch({ type: "LOAD_MORE_HIGH" }), []),
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
    ivHistoryDays: ivHistory.length,
    loading,
    lastRefreshed,
    refresh,
    scrollSignal,
  };
}
