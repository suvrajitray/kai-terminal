import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BrokerCredentials } from "@/types";

interface BrokerState {
  credentials: Record<string, BrokerCredentials>;
  saveCredentials: (brokerId: string, creds: BrokerCredentials) => void;
  setAccessToken: (brokerId: string, accessToken: string) => void;
  removeCredentials: (brokerId: string) => void;
  clearAll: () => void;
  isConnected: (brokerId: string) => boolean;
  isAuthenticated: (brokerId: string) => boolean;
  getCredentials: (brokerId: string) => BrokerCredentials | undefined;
}

export const useBrokerStore = create<BrokerState>()(
  persist(
    (set, get) => ({
      credentials: {},
      saveCredentials: (brokerId, creds) =>
        set((state) => ({
          credentials: { ...state.credentials, [brokerId]: creds },
        })),
      setAccessToken: (brokerId, accessToken) =>
        set((state) => {
          const existing = state.credentials[brokerId];
          if (!existing) return state;
          return {
            credentials: { ...state.credentials, [brokerId]: { ...existing, accessToken } },
          };
        }),
      removeCredentials: (brokerId) =>
        set((state) => {
          const next = { ...state.credentials };
          delete next[brokerId];
          return { credentials: next };
        }),
      clearAll: () => set({ credentials: {} }),
      isConnected: (brokerId) => brokerId in get().credentials,
      isAuthenticated: (brokerId) => !!get().credentials[brokerId]?.accessToken,
      getCredentials: (brokerId) => get().credentials[brokerId],
    }),
    { name: "kai-terminal-brokers" },
  ),
);
