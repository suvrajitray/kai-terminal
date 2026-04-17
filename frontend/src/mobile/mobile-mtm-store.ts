import { create } from 'zustand'

interface MobileMtmState {
  totalMtm: number | null
  setTotalMtm: (mtm: number) => void
}

export const useMobileMtmStore = create<MobileMtmState>((set) => ({
  totalMtm: null,
  setTotalMtm: (mtm) => set({ totalMtm: mtm }),
}))
