import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CandleInterval, InstrumentSearchResult } from "@/services/charts-api";

interface ChartsState {
  selectedInstrument: InstrumentSearchResult | null;
  selectedInterval: CandleInterval;
  setInstrument: (instrument: InstrumentSearchResult | null) => void;
  setInterval: (interval: CandleInterval) => void;
}

export const useChartsStore = create<ChartsState>()(
  persist(
    (set) => ({
      selectedInstrument: null,
      selectedInterval: "ThirtyMinute",
      setInstrument: (instrument) => set({ selectedInstrument: instrument }),
      setInterval: (interval) => set({ selectedInterval: interval }),
    }),
    { name: "kai-terminal-charts" }
  )
);
