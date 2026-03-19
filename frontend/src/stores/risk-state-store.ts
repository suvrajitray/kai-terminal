import { create } from "zustand";

interface BrokerRiskState {
  tslActive: boolean;
  tslFloor: number | null;
}

interface RiskStateStore {
  byBroker: Record<string, BrokerRiskState>;
  get: (broker: string) => BrokerRiskState;
  setTslActivated: (broker: string, floor: number) => void;
  setTslRaised: (broker: string, floor: number) => void;
  resetTsl: (broker: string) => void;
  reset: () => void;
}

const defaultState: BrokerRiskState = { tslActive: false, tslFloor: null };

export const useRiskStateStore = create<RiskStateStore>()((set, get) => ({
  byBroker: {},

  get: (broker) => get().byBroker[broker] ?? defaultState,

  setTslActivated: (broker, floor) =>
    set((s) => ({ byBroker: { ...s.byBroker, [broker]: { tslActive: true, tslFloor: floor } } })),

  setTslRaised: (broker, floor) =>
    set((s) => ({ byBroker: { ...s.byBroker, [broker]: { tslActive: true, tslFloor: floor } } })),

  resetTsl: (broker) =>
    set((s) => ({ byBroker: { ...s.byBroker, [broker]: defaultState } })),

  reset: () => set({ byBroker: {} }),
}));
