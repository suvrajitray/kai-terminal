import { useEffect, useRef, useState, useCallback } from "react";
import React from "react";
import * as signalR from "@microsoft/signalr";
import { toast as sonner } from "sonner";
import { toast } from "@/lib/toast";
import { fetchPositions, fetchZerodhaPositions } from "@/services/trading-api";
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { API_BASE_URL } from "@/lib/constants";
import { useBrokerStore } from "@/stores/broker-store";
import { useAuthStore } from "@/stores/auth-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import type { Position } from "@/types";

const KNOWN_UNDERLYINGS = ["BANKNIFTY", "MIDCPNIFTY", "FINNIFTY", "SENSEX", "BANKEX", "NIFTY"];
const MONTH_ABBR       = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const WEEKLY_MONTH_CODE: Record<string, number> = {
  "1":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"O":10,"N":11,"D":12,
};

function ordinalDay(d: number): string {
  if (d >= 11 && d <= 13) return `${d}th`;
  switch (d % 10) {
    case 1: return `${d}st`;
    case 2: return `${d}nd`;
    case 3: return `${d}rd`;
    default: return `${d}th`;
  }
}

/** Format ISO expiry "2026-04-13" → "13th APR" */
function expiryShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${ordinalDay(d)} ${MONTH_ABBR[m - 1]}`;
}

/**
 * Parse a raw broker trading symbol into a human-readable label.
 * Weekly:  NIFTY2641324250CE → "NIFTY 13th APR 24250 CE"
 * Monthly: NIFTY26APR24250CE → "NIFTY APR 24250 CE"
 * Fallback: returns the symbol unchanged.
 */
function formatFallbackSymbol(symbol: string): string {
  const type = symbol.endsWith("CE") ? "CE" : symbol.endsWith("PE") ? "PE" : null;
  if (!type) return symbol;
  const body = symbol.slice(0, -2);
  for (const u of KNOWN_UNDERLYINGS) {
    if (!body.startsWith(u)) continue;
    const after = body.slice(u.length + 2); // skip underlying + YY
    const upper3 = after.slice(0, 3).toUpperCase();
    const monthIdx = MONTH_ABBR.indexOf(upper3);
    let expiryLabel: string;
    let strike: number;
    if (monthIdx >= 0) {
      strike     = parseInt(after.slice(3), 10);
      expiryLabel = MONTH_ABBR[monthIdx];
    } else {
      const month = WEEKLY_MONTH_CODE[after[0].toUpperCase()];
      if (!month) break;
      const day  = parseInt(after.slice(1, 3), 10);
      strike     = parseInt(after.slice(3), 10);
      expiryLabel = `${ordinalDay(day)} ${MONTH_ABBR[month - 1]}`;
    }
    if (isNaN(strike)) break;
    return `${u} ${expiryLabel} ${strike} ${type}`;
  }
  return symbol;
}

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
      setPositions((prev) => {
        if (prev.length === 0) return incoming;
        // Preserve live LTP (and derived PnL) for positions we already track —
        // the REST poll returns stale LTP which would clobber the live feed.
        const liveMap = new Map(prev.map((p) => [p.instrumentToken, p]));
        return incoming.map((p) => {
          const live = liveMap.get(p.instrumentToken);
          if (!live) return p;
          const ltp = live.ltp;
          const pnl = p.pnl + p.quantity * (ltp - p.ltp);
          return { ...p, ltp, pnl };
        });
      });
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
      averagePrice: number;
      transactionType: string;
      filledQuantity: number;
    }) => {
      const s = update.status.toLowerCase();
      if (s === "rejected") {
        toast.error(
          update.statusMessage
            ? `Order rejected: ${update.tradingSymbol} — ${update.statusMessage}`
            : `Order rejected: ${update.tradingSymbol}`
        );
      } else if (s === "complete") {
        const contracts = useOptionContractsStore.getState();
        const lookup = contracts.getByInstrumentKey(update.tradingSymbol, update.tradingSymbol);
        const label = lookup
          ? `${lookup.index} ${expiryShort(lookup.contract.expiry)} ${lookup.contract.strikePrice} ${lookup.contract.instrumentType}`
          : formatFallbackSymbol(update.tradingSymbol);
        const side      = update.transactionType?.toUpperCase();
        const sideColor = side === "BUY" ? "#22c55e" : side === "SELL" ? "#f43f5e" : undefined;
        const priceFormatted = update.averagePrice > 0
          ? update.averagePrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : null;
        const desc = (
          <div className="flex flex-col gap-0.5 mt-0.5">
            <p className="text-sm leading-snug">
              {side && (
                <span style={{ color: sideColor }} className="font-semibold">{side} </span>
              )}
              {label} is complete.
            </p>
            {(update.filledQuantity > 0 || priceFormatted) && (
              <p className="text-sm leading-snug">
                {update.filledQuantity > 0 && `${update.filledQuantity} qty`}
                {priceFormatted && ` @ ₹${priceFormatted}`}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">#{update.orderId}</p>
          </div>
        );
        sonner.success("Complete", { description: desc });
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
