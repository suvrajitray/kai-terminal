import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TRADING_SETTINGS, type UserTradingSettings } from "@/services/user-settings-api";

interface UserTradingSettingsState extends UserTradingSettings {
  setSettings: (settings: UserTradingSettings) => void;
  reset: () => void;
}

export const useUserTradingSettingsStore = create<UserTradingSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_TRADING_SETTINGS,
      setSettings: (settings) => set(settings),
      reset: () => set(DEFAULT_TRADING_SETTINGS),
    }),
    { name: "kai-terminal-user-trading-settings" },
  ),
);
