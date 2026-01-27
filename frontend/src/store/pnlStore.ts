import { create } from "zustand";

type TrailingConfig = {
  enabled: boolean;
  activateAt: number;
  lockAt: number;
  profitStep: number;
  tslStep: number;
};

type PnlStore = {
  totalPnl: number;
  setTotalPnl: (pnl: number) => void;

  mtmStopLoss: number;
  setMtmStopLoss: (v: number) => void;

  trailing: TrailingConfig;
  setTrailing: (t: Partial<TrailingConfig>) => void;
};

export const usePnlStore = create<PnlStore>((set) => ({
  totalPnl: 0,
  setTotalPnl: (pnl) => set({ totalPnl: pnl }),

  mtmStopLoss: -5000,
  setMtmStopLoss: (v) => set({ mtmStopLoss: v }),

  trailing: {
    enabled: false,
    activateAt: 8000,
    lockAt: 6000,
    profitStep: 2000,
    tslStep: 1000,
  },

  setTrailing: (t) =>
    set((state) => ({
      trailing: { ...state.trailing, ...t },
    })),
}));
