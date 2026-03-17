import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isActive: boolean;
  isAdmin: boolean;
  login: (user: User, token: string, isActive?: boolean, isAdmin?: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isActive: false,
      isAdmin: false,
      login: (user, token, isActive = true, isAdmin = false) =>
        set({ user, token, isAuthenticated: true, isActive, isAdmin }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, isActive: false, isAdmin: false }),
    }),
    { name: "kai-terminal-auth" },
  ),
);
