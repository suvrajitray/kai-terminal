import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BrokerState {
  authenticated: Record<string, boolean>;
  setAuthenticated: (broker: string, value: boolean) => void;
  isAuthenticated: (broker: string) => boolean;
}

export const useBrokerStore = create<BrokerState>()(
  persist(
    (set, get) => ({
      authenticated: {},
      setAuthenticated: (broker, value) =>
        set((s) => ({ authenticated: { ...s.authenticated, [broker]: value } })),
      isAuthenticated: (broker) => get().authenticated[broker] ?? false,
    }),
    { name: 'broker-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);
