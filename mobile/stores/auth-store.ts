import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  token: string | null;
  email: string | null;
  name: string | null;
  isActive: boolean;
  setToken: (token: string) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

function parseJwt(token: string) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = JSON.parse(atob(base64));
  return { email: json.sub, name: json.name, isActive: json.isActive === 'true' || json.isActive === true };
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null, email: null, name: null, isActive: false,
  setToken: (token) => {
    SecureStore.setItemAsync('jwt', token);
    const claims = parseJwt(token);
    set({ token, ...claims });
  },
  logout: () => {
    SecureStore.deleteItemAsync('jwt');
    set({ token: null, email: null, name: null, isActive: false });
  },
  hydrate: async () => {
    const token = await SecureStore.getItemAsync('jwt');
    if (token) {
      try {
        const claims = parseJwt(token);
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && payload.exp * 1000 > Date.now()) {
          set({ token, ...claims });
        }
      } catch { /* expired or invalid — stay logged out */ }
    }
  },
}));
