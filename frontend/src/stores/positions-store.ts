import { create } from "zustand";
import type { Position } from "@/types";

interface PositionsState {
  positions: Position[];
  setPositions: (positions: Position[]) => void;
}

export const usePositionsStore = create<PositionsState>()((set) => ({
  positions: [],
  setPositions: (positions) => set({ positions }),
}));
