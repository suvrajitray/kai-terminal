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
  autoShiftEnabled: boolean;
  autoShiftThresholdPct: number;  // trigger when sell position LTP rises by this % from entry
  autoShiftMaxCount: number;      // after this many shifts, exit the position
  autoShiftStrikeGap: number;     // number of strikes to move per shift
  watchedProducts: "All" | "Intraday" | "Delivery";  // which product types the risk engine evaluates
}

export const defaults: ProfitProtectionConfig = {
  enabled:               import.meta.env.VITE_PP_ENABLED              !== "false",
  watchedProducts:       (import.meta.env.VITE_PP_WATCHED_PRODUCTS    as ProfitProtectionConfig["watchedProducts"]) || "All",
  mtmTarget:             Number(import.meta.env.VITE_PP_MTM_TARGET)            || 15000,
  mtmSl:                 Number(import.meta.env.VITE_PP_MTM_SL)                || -20000,
  trailingEnabled:       import.meta.env.VITE_PP_TRAILING_ENABLED      !== "false",
  trailingActivateAt:    Number(import.meta.env.VITE_PP_TRAILING_ACTIVATE_AT)  || 5000,
  lockProfitAt:          Number(import.meta.env.VITE_PP_LOCK_PROFIT_AT)        || 1000,
  increaseBy:            Number(import.meta.env.VITE_PP_INCREASE_BY)           || 100,
  trailBy:               Number(import.meta.env.VITE_PP_TRAIL_BY)              || 50,
  autoShiftEnabled:      import.meta.env.VITE_PP_AUTO_SHIFT_ENABLED    !== "false",
  autoShiftThresholdPct: Number(import.meta.env.VITE_PP_AUTO_SHIFT_THRESHOLD_PCT) || 35,
  autoShiftMaxCount:     Number(import.meta.env.VITE_PP_AUTO_SHIFT_MAX_COUNT)      || 1,
  autoShiftStrikeGap:    Number(import.meta.env.VITE_PP_AUTO_SHIFT_STRIKE_GAP)     || 1,
};

interface ProfitProtectionState {
  configs: Record<string, ProfitProtectionConfig>;  // keyed by brokerType ("upstox" | "zerodha")
  loadedBrokers: string[];                          // replaces single isLoaded boolean
  pendingOpenBrokerId: string | null;               // signals terminal page to open PP dialog
  getConfig: (broker: string) => ProfitProtectionConfig;
  setEnabled: (broker: string, enabled: boolean) => void;
  setConfig: (broker: string, config: Partial<ProfitProtectionConfig>) => void;
  markLoaded: (broker: string) => void;
  requestOpen: (brokerId: string) => void;
  clearPendingOpen: () => void;
  reset: () => void;
}

export const useProfitProtectionStore = create<ProfitProtectionState>()((set, get) => ({
  configs: {},
  loadedBrokers: [],
  pendingOpenBrokerId: null,

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

  requestOpen: (brokerId) => set({ pendingOpenBrokerId: brokerId }),
  clearPendingOpen: () => set({ pendingOpenBrokerId: null }),

  reset: () => set({ configs: {}, loadedBrokers: [], pendingOpenBrokerId: null }),
}));
