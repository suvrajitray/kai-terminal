import { apiClient } from "@/lib/api-client";

export interface UserTradingSettings {
  defaultStoplossPercentage: number;
  niftyShiftOffset: number;
  sensexShiftOffset: number;
  bankniftyShiftOffset: number;
  indexChangeMode: "open" | "prevClose";
}

export const DEFAULT_TRADING_SETTINGS: UserTradingSettings = {
  defaultStoplossPercentage: 30,
  niftyShiftOffset: 5,
  sensexShiftOffset: 10,
  bankniftyShiftOffset: 10,
  indexChangeMode: "prevClose",
};

export async function fetchUserTradingSettings(): Promise<UserTradingSettings> {
  const res = await apiClient.get<UserTradingSettings>("/api/user-settings");
  return res.data;
}

export async function saveUserTradingSettings(settings: UserTradingSettings): Promise<void> {
  await apiClient.put("/api/user-settings", settings);
}
