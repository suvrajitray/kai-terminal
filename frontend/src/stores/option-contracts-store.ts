import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ContractEntry, IndexContracts } from "@/types";

const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

/** Formats ISO date "2026-03-17" → "17MAR26" for display */
export function formatExpiryLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}${MONTH_ABBR[m - 1]}${String(y).slice(-2)}`;
}

export interface ContractLookup {
  contract: ContractEntry;
  /** The index name derived from the store key, e.g. "NIFTY", "BANKNIFTY" */
  index: string;
}

interface OptionContractsState {
  contracts: Record<string, ContractEntry[]>; // keyed by index name e.g. "NIFTY", "BANKNIFTY"
  setIndexContracts: (data: IndexContracts[]) => void;
  getContracts: (key: string) => ContractEntry[];
  getByInstrumentKey: (instrumentToken: string) => ContractLookup | undefined;
  getExpiries: (key: string) => string[];
  clear: () => void;
}

export const useOptionContractsStore = create<OptionContractsState>()(
  persist(
    (set, get) => ({
      contracts: {},

      setIndexContracts: (data) => {
        const next: Record<string, ContractEntry[]> = {};
        for (const idx of data) next[idx.index] = idx.contracts;
        set((s) => ({ contracts: { ...s.contracts, ...next } }));
      },

      getContracts: (key) => get().contracts[key] ?? [],

      getByInstrumentKey: (instrumentToken) => {
        // Zerodha positions report instrument_token as "NFO|15942914"; strip exchange prefix for comparison
        const numericPart = instrumentToken.includes("|")
          ? instrumentToken.split("|")[1]
          : instrumentToken;

        for (const [key, contracts] of Object.entries(get().contracts)) {
          const found = contracts.find(
            (c) => c.upstoxToken === instrumentToken ||
                   c.zerodhaToken === numericPart,
          );
          if (found) {
            return { contract: found, index: key };
          }
        }
        return undefined;
      },

      getExpiries: (key) => {
        const contracts = get().contracts[key] ?? [];
        return [...new Set(contracts.map((c) => c.expiry))].sort();
      },

      clear: () => set({ contracts: {} }),
    }),
    { name: "kai-terminal-option-contracts" },
  ),
);
