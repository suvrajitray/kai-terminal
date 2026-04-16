import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  token: string | null;
  email: string | null;
  name: string | null;
  isActive: boolean;
  isAdmin: boolean;
  isHydrated: boolean;
  setToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

function parseJwt(token: string) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = JSON.parse(atob(base64));
  return {
    email: json.sub,
    name: json.name,
    isActive: json.isActive === 'true' || json.isActive === true,
    isAdmin:  json.isAdmin  === 'true' || json.isAdmin  === true,
    exp: json.exp as number | undefined,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null, email: null, name: null,
  isActive: false, isAdmin: false, isHydrated: false,
  setToken: async (token) => {
    await SecureStore.setItemAsync('jwt', token);
    const { email, name, isActive, isAdmin } = parseJwt(token);
    set({ token, email, name, isActive, isAdmin });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync('jwt');
    set({ token: null, email: null, name: null, isActive: false, isAdmin: false });
  },
  hydrate: async () => {
    const token = await SecureStore.getItemAsync('jwt');
    if (token) {
      try {
        const claims = parseJwt(token);
        if (claims.exp && claims.exp * 1000 > Date.now()) {
          set({ token, email: claims.email, name: claims.name, isActive: claims.isActive, isAdmin: claims.isAdmin });
        } else {
          // Token expired — clean it up
          await SecureStore.deleteItemAsync('jwt');
        }
      } catch {
        // Invalid token — clean up
        await SecureStore.deleteItemAsync('jwt');
      }
    }
    set({ isHydrated: true });
  },
}));
