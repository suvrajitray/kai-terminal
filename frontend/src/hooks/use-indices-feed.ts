import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL } from "@/lib/constants";
import { useBrokerStore } from "@/stores/broker-store";

export interface IndexQuote {
  ltp: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  netChange: number | null;
}

export interface IndexPrices {
  nifty: IndexQuote;
  bankNifty: IndexQuote;
  sensex: IndexQuote;
  finNifty: IndexQuote;
  bankex: IndexQuote;
}

const EMPTY_QUOTE: IndexQuote = { ltp: null, open: null, high: null, low: null, netChange: null };
const INITIAL: IndexPrices = { nifty: EMPTY_QUOTE, bankNifty: EMPTY_QUOTE, sensex: EMPTY_QUOTE, finNifty: EMPTY_QUOTE, bankex: EMPTY_QUOTE };

const TOKEN_MAP: Record<string, keyof IndexPrices> = {
  "NSE_INDEX|Nifty 50": "nifty",
  "NSE_INDEX|Nifty Bank": "bankNifty",
  "BSE_INDEX|SENSEX": "sensex",
  "NSE_INDEX|Nifty Fin Service": "finNifty",
  "BSE_INDEX|BANKEX": "bankex",
};

type IndexUpdate = { instrumentToken: string; ltp: number; open?: number; high?: number; low?: number; netChange?: number };

export function useIndicesFeed(): IndexPrices {
  const [prices, setPrices] = useState<IndexPrices>(INITIAL);

  useEffect(() => {
    const upstoxToken = useBrokerStore.getState().getCredentials("upstox")?.accessToken;
    if (!upstoxToken) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/indices?upstoxToken=${encodeURIComponent(upstoxToken)}`)
      .withAutomaticReconnect()
      .build();

    const applyUpdates = (updates: IndexUpdate[], prev: IndexPrices): IndexPrices => {
      const next = { ...prev };
      for (const { instrumentToken, ltp, open, high, low, netChange } of updates) {
        const key = TOKEN_MAP[instrumentToken];
        if (!key) continue;
        next[key] = {
          ltp,
          open:      open      ?? prev[key].open,
          high:      high      ?? prev[key].high,
          low:       low       ?? prev[key].low,
          netChange: netChange ?? prev[key].netChange,
        };
      }
      return next;
    };

    conn.on("ReceiveIndexSnapshot", (data: IndexUpdate[]) =>
      setPrices((prev) => applyUpdates(data, prev)));

    conn.on("ReceiveIndexBatch", (data: IndexUpdate[]) =>
      setPrices((prev) => applyUpdates(data, prev)));

    conn.start().catch(() => {});

    return () => { conn.stop(); };
  }, []);

  return prices;
}
