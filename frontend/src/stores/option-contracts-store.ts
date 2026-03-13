import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OptionContract } from "@/types";

const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

/** Formats ISO date "2026-03-17" → "17MAR26" for display */
export function formatExpiryLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}${MONTH_ABBR[m - 1]}${String(y).slice(-2)}`;
}

interface OptionContractsState {
  contracts: Record<string, OptionContract[]>; // keyed by underlying e.g. "NIFTY"
  setContracts: (underlying: string, contracts: OptionContract[]) => void;
  getContracts: (underlying: string) => OptionContract[];
  getByInstrumentKey: (instrumentKey: string) => OptionContract | undefined;
  getExpiries: (underlying: string) => string[];
  clear: () => void;
}

export const useOptionContractsStore = create<OptionContractsState>()(
  persist(
    (set, get) => ({
      contracts: {},

      setContracts: (underlying, contracts) =>
        set((state) => ({ contracts: { ...state.contracts, [underlying]: contracts } })),

      getContracts: (underlying) => get().contracts[underlying] ?? [],

      getByInstrumentKey: (instrumentKey) => {
        for (const contracts of Object.values(get().contracts)) {
          const found = contracts.find((c) => c.instrument_key === instrumentKey);
          if (found) return found;
        }
        return undefined;
      },

      getExpiries: (underlying) => {
        const contracts = get().contracts[underlying] ?? [];
        return [...new Set(contracts.map((c) => c.expiry))].sort();
      },

      clear: () => set({ contracts: {} }),
    }),
    { name: "kai-terminal-option-contracts" },
  ),
);
