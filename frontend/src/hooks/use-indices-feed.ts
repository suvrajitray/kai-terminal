import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL } from "@/lib/constants";
import { useBrokerStore } from "@/stores/broker-store";

export interface IndexQuote {
  ltp: number | null;
  open: number | null;
  high: number | null;
}

export interface IndexPrices {
  nifty: IndexQuote;
  bankNifty: IndexQuote;
  sensex: IndexQuote;
}

const EMPTY_QUOTE: IndexQuote = { ltp: null, open: null, high: null };
const INITIAL: IndexPrices = { nifty: EMPTY_QUOTE, bankNifty: EMPTY_QUOTE, sensex: EMPTY_QUOTE };

const TOKEN_MAP: Record<string, keyof IndexPrices> = {
  "NSE_INDEX|Nifty 50": "nifty",
  "NSE_INDEX|Nifty Bank": "bankNifty",
  "BSE_INDEX|SENSEX": "sensex",
};

export function useIndicesFeed(): IndexPrices {
  const [prices, setPrices] = useState<IndexPrices>(INITIAL);

  useEffect(() => {
    const upstoxToken = useBrokerStore.getState().getCredentials("upstox")?.accessToken;
    if (!upstoxToken) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/indices?upstoxToken=${encodeURIComponent(upstoxToken)}`)
      .withAutomaticReconnect()
      .build();

    conn.on("ReceiveIndexSnapshot", (snapshot: Array<{ instrumentToken: string; ltp: number; open?: number; high?: number }>) => {
      setPrices((prev) => {
        const next = { ...prev };
        for (const { instrumentToken, ltp, open, high } of snapshot) {
          const key = TOKEN_MAP[instrumentToken];
          if (key) next[key] = { ltp, open: open ?? null, high: high ?? null };
        }
        return next;
      });
    });

    conn.on("ReceiveIndexBatch", (updates: Array<{ instrumentToken: string; ltp: number; open?: number; high?: number }>) => {
      setPrices((prev) => {
        const next = { ...prev };
        for (const { instrumentToken, ltp, open, high } of updates) {
          const key = TOKEN_MAP[instrumentToken];
          if (!key) continue;
          next[key] = { ltp, open: open ?? prev[key].open, high: high ?? prev[key].high };
        }
        return next;
      });
    });

    conn.start().catch(() => {});

    return () => { conn.stop(); };
  }, []);

  return prices;
}
