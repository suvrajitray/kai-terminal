import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BrokerCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string; // "NA" means not authenticated for the day
}

interface BrokerState {
  credentials: Record<string, BrokerCredentials>;
  authenticated: Record<string, boolean>; // true when receiving live SignalR positions
  setCredentials: (broker: string, creds: BrokerCredentials) => void;
  setAccessToken: (broker: string, accessToken: string) => void;
  setAuthenticated: (broker: string, value: boolean) => void;
  isAuthenticated: (broker: string) => boolean;
  isSessionActive: (broker: string) => boolean; // accessToken is valid (not "NA")
  hasCredentials: (broker: string) => boolean;
  getCredentials: (broker: string) => BrokerCredentials | undefined;
}

export const useBrokerStore = create<BrokerState>()(
  persist(
    (set, get) => ({
      credentials: {},
      authenticated: {},
      setCredentials: (broker, creds) =>
        set((s) => ({ credentials: { ...s.credentials, [broker]: creds } })),
      setAccessToken: (broker, accessToken) =>
        set((s) => {
          const existing = s.credentials[broker];
          if (!existing) return s;
          return { credentials: { ...s.credentials, [broker]: { ...existing, accessToken } } };
        }),
      setAuthenticated: (broker, value) =>
        set((s) => ({ authenticated: { ...s.authenticated, [broker]: value } })),
      isAuthenticated: (broker) => get().authenticated[broker] ?? false,
      isSessionActive: (broker) => {
        const token = get().credentials[broker]?.accessToken;
        return !!token; // backend returns "" for stale/expired tokens, non-empty = valid
      },
      hasCredentials: (broker) => broker in get().credentials,
      getCredentials: (broker) => get().credentials[broker],
    }),
    { name: 'broker-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);
