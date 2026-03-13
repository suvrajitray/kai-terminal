import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TRADING_SETTINGS, type UserTradingSettings } from "@/services/user-settings-api";

export type IndexChangeMode = "open" | "prevClose";

interface UserTradingSettingsState extends UserTradingSettings {
  indexChangeMode: IndexChangeMode;
  setSettings: (settings: UserTradingSettings) => void;
  setIndexChangeMode: (mode: IndexChangeMode) => void;
  reset: () => void;
}

export const useUserTradingSettingsStore = create<UserTradingSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_TRADING_SETTINGS,
      indexChangeMode: "open",
      setSettings: (settings) => set(settings),
      setIndexChangeMode: (mode) => set({ indexChangeMode: mode }),
      reset: () => set({ ...DEFAULT_TRADING_SETTINGS, indexChangeMode: "open" }),
    }),
    { name: "kai-terminal-user-trading-settings" },
  ),
);
