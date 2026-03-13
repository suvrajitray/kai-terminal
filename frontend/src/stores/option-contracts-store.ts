import { create } from "zustand";
import type { OptionContract } from "@/types";

interface OptionContractsState {
  contracts: Record<string, OptionContract[]>; // keyed by underlying e.g. "NIFTY"
  setContracts: (underlying: string, contracts: OptionContract[]) => void;
  getContracts: (underlying: string) => OptionContract[];
  getExpiries: (underlying: string) => string[];
  clear: () => void;
}

export const useOptionContractsStore = create<OptionContractsState>((set, get) => ({
  contracts: {},

  setContracts: (underlying, contracts) =>
    set((state) => ({ contracts: { ...state.contracts, [underlying]: contracts } })),

  getContracts: (underlying) => get().contracts[underlying] ?? [],

  getExpiries: (underlying) => {
    const contracts = get().contracts[underlying] ?? [];
    return [...new Set(contracts.map((c) => c.expiry))].sort();
  },

  clear: () => set({ contracts: {} }),
}));
