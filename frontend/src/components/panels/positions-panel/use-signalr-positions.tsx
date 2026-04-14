import { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { toast as sonner } from "sonner";
import { toast } from "@/lib/toast";
import { API_BASE_URL } from "@/lib/constants";
import { useBrokerStore } from "@/stores/broker-store";
import { useAuthStore } from "@/stores/auth-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";
import { isBrokerTokenExpired } from "@/lib/token-utils";
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

interface UseSignalrPositionsOptions {
  onPositions: (positions: Position[]) => void;
  onLtpBatch: (updates: Array<{ instrumentToken: string; ltp: number }>) => void;
  onOrderUpdate?: () => void;
  onFallbackLoad: () => void;
  setLoading: (loading: boolean) => void;
}

export function useSignalrPositions({
  onPositions,
  onLtpBatch,
  onOrderUpdate,
  onFallbackLoad,
  setLoading,
}: UseSignalrPositionsOptions) {
  const [isLive, setIsLive] = useState(false);

  // Use refs so the effect captures the latest callbacks without re-running
  const onPositionsRef    = useRef(onPositions);
  const onLtpBatchRef     = useRef(onLtpBatch);
  const onOrderUpdateRef  = useRef(onOrderUpdate);
  const onFallbackLoadRef = useRef(onFallbackLoad);
  const setLoadingRef     = useRef(setLoading);

  // Keep refs current on every render
  onPositionsRef.current    = onPositions;
  onLtpBatchRef.current     = onLtpBatch;
  onOrderUpdateRef.current  = onOrderUpdate;
  onFallbackLoadRef.current = onFallbackLoad;
  setLoadingRef.current     = setLoading;

  useEffect(() => {
    const { getCredentials } = useBrokerStore.getState();
    const upstoxToken   = getCredentials("upstox")?.accessToken;
    const zerodhaToken  = getCredentials("zerodha")?.accessToken;
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
      onPositionsRef.current(incoming);
      setLoadingRef.current(false);
    });

    conn.on("ReceiveLtpBatch", (updates: Array<{ instrumentToken: string; ltp: number }>) => {
      onLtpBatchRef.current(updates);
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
        onFallbackLoadRef.current(); // refresh positions immediately on fill
      }
      onOrderUpdateRef.current?.();
    });

    conn.onreconnecting(() => setIsLive(false));
    conn.onreconnected(() => setIsLive(true));
    conn.onclose(() => setIsLive(false));

    setLoadingRef.current(true);
    conn.start()
      .then(() => setIsLive(true))
      .catch(() => {
        setIsLive(false);
        onFallbackLoadRef.current();
      });

    return () => {
      conn.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isLive };
}
