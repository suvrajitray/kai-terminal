import { apiClient } from "@/lib/api-client";

// Only intervals supported by the Upstox v2 historical candle API
export type CandleInterval =
  | "OneMinute"
  | "ThirtyMinute"
  | "OneDay"
  | "OneWeek"
  | "OneMonth";

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}

export interface InstrumentSearchResult {
  instrumentKey: string;
  tradingSymbol: string;
  name: string;
  exchange: string;
  instrumentType: string;
}

export async function fetchCandles(
  instrumentKey: string,
  interval: CandleInterval,
  from?: string,
  to?: string
): Promise<Candle[]> {
  const res = await apiClient.get<Candle[]>("/api/upstox/charts/candles", {
    params: { instrumentKey, interval, from, to },
  });
  return res.data;
}

export async function searchInstruments(q: string): Promise<InstrumentSearchResult[]> {
  const res = await apiClient.get<InstrumentSearchResult[]>("/api/upstox/charts/search", {
    params: { q },
  });
  return res.data;
}
