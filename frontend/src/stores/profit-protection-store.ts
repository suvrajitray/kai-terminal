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

interface ProfitProtectionState extends ProfitProtectionConfig {
  setEnabled: (enabled: boolean) => void;
  setConfig: (config: Partial<ProfitProtectionConfig>) => void;
  reset: () => void;
}

export const useProfitProtectionStore = create<ProfitProtectionState>()(
  persist(
    (set) => ({
      enabled: false,
      mtmTarget: 25000,
      mtmSl: -25000,
      trailingEnabled: true,
      increaseBy: 1000,
      trailBy: 500,
      setEnabled: (enabled) => set({ enabled }),
      setConfig: (config) => set((s) => ({ ...s, ...config })),
      reset: () => set({ enabled: false, mtmTarget: 25000, mtmSl: -25000, trailingEnabled: true, increaseBy: 1000, trailBy: 500 }),
    }),
    { name: "kai-terminal-profit-protection" },
  ),
);
