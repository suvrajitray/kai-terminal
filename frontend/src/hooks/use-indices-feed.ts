import { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL } from "@/lib/constants";

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
  "NSE_INDEX|Nifty 50":        "nifty",
  "NSE_INDEX|Nifty Bank":      "bankNifty",
  "BSE_INDEX|SENSEX":          "sensex",
  "NSE_INDEX|Nifty Fin Service": "finNifty",
  "BSE_INDEX|BANKEX":          "bankex",
};

type SnapshotUpdate = { instrumentToken: string; ltp: number; open?: number; high?: number; low?: number; netChange?: number };
type BatchUpdate    = { instrumentToken: string; ltp: number };

export function useIndicesFeed(): IndexPrices {
  const [prices, setPrices] = useState<IndexPrices>(INITIAL);
  // prevClose per index key — computed once from snapshot, used to derive netChange on ticks
  const prevCloseRef = useRef<Partial<Record<keyof IndexPrices, number>>>({});

  useEffect(() => {
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/indices`)
      .withAutomaticReconnect()
      .build();

    conn.on("ReceiveIndexSnapshot", (data: SnapshotUpdate[]) => {
      setPrices((prev) => {
        const next = { ...prev };
        for (const { instrumentToken, ltp, open, high, low, netChange } of data) {
          const key = TOKEN_MAP[instrumentToken];
          if (!key) continue;
          // Store prevClose so batches can compute netChange without another REST call
          prevCloseRef.current[key] = ltp - (netChange ?? 0);
          next[key] = {
            ltp,
            open:      open      ?? prev[key].open,
            high:      high      ?? prev[key].high,
            low:       low       ?? prev[key].low,
            netChange: netChange ?? prev[key].netChange,
          };
        }
        return next;
      });
    });

    conn.on("ReceiveIndexBatch", (data: BatchUpdate[]) => {
      setPrices((prev) => {
        const next = { ...prev };
        for (const { instrumentToken, ltp } of data) {
          const key = TOKEN_MAP[instrumentToken];
          if (!key) continue;
          const prevClose = prevCloseRef.current[key];
          next[key] = {
            ...prev[key],
            ltp,
            netChange: prevClose !== undefined ? ltp - prevClose : prev[key].netChange,
          };
        }
        return next;
      });
    });

    conn.start().catch(() => {});

    return () => { conn.stop(); };
  }, []);

  return prices;
}
