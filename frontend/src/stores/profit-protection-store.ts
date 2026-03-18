import { create } from "zustand";

export interface ProfitProtectionConfig {
  enabled: boolean;
  mtmTarget: number;           // exit all when MTM >= this
  mtmSl: number;               // initial stop loss (exit all when MTM <= this)
  trailingEnabled: boolean;
  trailingActivateAt: number;  // trailing starts only when MTM first reaches this value
  lockProfitAt: number;        // SL floor jumps to this value the moment trailing activates
  increaseBy: number;          // every time MTM gains this much from last step...
  trailBy: number;             // ...raise the SL floor by this much
}

export const defaults: ProfitProtectionConfig = {
  enabled:            false,
  mtmTarget:          Number(import.meta.env.VITE_PP_MTM_TARGET)            || 25000,
  mtmSl:              Number(import.meta.env.VITE_PP_MTM_SL)                || -25000,
  trailingEnabled:    import.meta.env.VITE_PP_TRAILING_ENABLED !== "false",
  trailingActivateAt: Number(import.meta.env.VITE_PP_TRAILING_ACTIVATE_AT)  || 12000,
  lockProfitAt:       Number(import.meta.env.VITE_PP_LOCK_PROFIT_AT)        || 2000,
  increaseBy:         Number(import.meta.env.VITE_PP_INCREASE_BY)           || 99,
  trailBy:            Number(import.meta.env.VITE_PP_TRAIL_BY)              || 33,
};

interface ProfitProtectionState {
  configs: Record<string, ProfitProtectionConfig>;  // keyed by brokerType ("upstox" | "zerodha")
  loadedBrokers: string[];                          // replaces single isLoaded boolean
  getConfig: (broker: string) => ProfitProtectionConfig;
  setEnabled: (broker: string, enabled: boolean) => void;
  setConfig: (broker: string, config: Partial<ProfitProtectionConfig>) => void;
  markLoaded: (broker: string) => void;
  reset: () => void;
}

export const useProfitProtectionStore = create<ProfitProtectionState>()((set, get) => ({
  configs: {},
  loadedBrokers: [],

  getConfig: (broker) => get().configs[broker] ?? defaults,

  setEnabled: (broker, enabled) =>
    set((s) => ({
      configs: { ...s.configs, [broker]: { ...(s.configs[broker] ?? defaults), enabled } },
    })),

  setConfig: (broker, config) =>
    set((s) => ({
      configs: { ...s.configs, [broker]: { ...(s.configs[broker] ?? defaults), ...config } },
    })),

  markLoaded: (broker) =>
    set((s) => ({
      loadedBrokers: s.loadedBrokers.includes(broker) ? s.loadedBrokers : [...s.loadedBrokers, broker],
    })),

  reset: () => set({ configs: {}, loadedBrokers: [] }),
}));
