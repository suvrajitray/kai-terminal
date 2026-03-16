import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ProfitProtectionConfig {
  enabled: boolean;
  mtmTarget: number;      // exit all when MTM >= this
  mtmSl: number;          // initial stop loss (exit all when MTM <= this)
  trailingEnabled: boolean;
  increaseBy: number;     // every time MTM gains this much from last step...
  trailBy: number;        // ...raise the SL floor by this much
}

const defaults: ProfitProtectionConfig = {
  enabled:         false,
  mtmTarget:       Number(import.meta.env.VITE_PP_MTM_TARGET)       || 25000,
  mtmSl:           Number(import.meta.env.VITE_PP_MTM_SL)           || -25000,
  trailingEnabled: import.meta.env.VITE_PP_TRAILING_ENABLED !== "false",
  increaseBy:      Number(import.meta.env.VITE_PP_INCREASE_BY)      || 1000,
  trailBy:         Number(import.meta.env.VITE_PP_TRAIL_BY)         || 500,
};

interface ProfitProtectionState extends ProfitProtectionConfig {
  setEnabled: (enabled: boolean) => void;
  setConfig: (config: Partial<ProfitProtectionConfig>) => void;
  reset: () => void;
}

export const useProfitProtectionStore = create<ProfitProtectionState>()(
  persist(
    (set) => ({
      ...defaults,
      setEnabled: (enabled) => set({ enabled }),
      setConfig: (config) => set((s) => ({ ...s, ...config })),
      reset: () => set(defaults),
    }),
    { name: "kai-terminal-profit-protection" },
  ),
);
