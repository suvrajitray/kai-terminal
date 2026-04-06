import { create } from "zustand";
import type { RiskLogEntry } from "@/types";

const MAX = 500;

interface RiskLogStore {
  entries:  RiskLogEntry[];
  loaded:   boolean;
  setAll:   (entries: RiskLogEntry[]) => void;
  prepend:  (entry: RiskLogEntry) => void;
  clear:    () => void;
}

export const useRiskLogStore = create<RiskLogStore>()((set) => ({
  entries: [],
  loaded:  false,

  setAll: (entries) => set({ entries, loaded: true }),

  prepend: (entry) =>
    set((s) => ({ entries: [entry, ...s.entries].slice(0, MAX) })),

  clear: () => set({ entries: [], loaded: false }),
}));
