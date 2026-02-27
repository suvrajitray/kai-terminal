import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BrokerCredentials } from "@/types";

interface BrokerState {
  credentials: Record<string, BrokerCredentials>;
  saveCredentials: (brokerId: string, creds: BrokerCredentials) => void;
  removeCredentials: (brokerId: string) => void;
  isConnected: (brokerId: string) => boolean;
}

export const useBrokerStore = create<BrokerState>()(
  persist(
    (set, get) => ({
      credentials: {},
      saveCredentials: (brokerId, creds) =>
        set((state) => ({
          credentials: { ...state.credentials, [brokerId]: creds },
        })),
      removeCredentials: (brokerId) =>
        set((state) => {
          const next = { ...state.credentials };
          delete next[brokerId];
          return { credentials: next };
        }),
      isConnected: (brokerId) => brokerId in get().credentials,
    }),
    { name: "kai-terminal-brokers" },
  ),
);
