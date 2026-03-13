import { apiClient } from "@/lib/api-client";

export interface UserTradingSettings {
  defaultStoplossPercentage: number;
  niftyShiftOffset: number;
  bankniftyShiftOffset: number;
  midcpniftyShiftOffset: number;
  finniftyShiftOffset: number;
  sensexShiftOffset: number;
  bankexShiftOffset: number;
  indexChangeMode: "open" | "prevClose";
}

export const DEFAULT_TRADING_SETTINGS: UserTradingSettings = {
  defaultStoplossPercentage: 30,
  niftyShiftOffset: 5,
  bankniftyShiftOffset: 10,
  midcpniftyShiftOffset: 10,
  finniftyShiftOffset: 10,
  sensexShiftOffset: 10,
  bankexShiftOffset: 10,
  indexChangeMode: "open",
};

export async function fetchUserTradingSettings(): Promise<UserTradingSettings> {
  const res = await apiClient.get<UserTradingSettings>("/api/user-settings");
  return res.data;
}

export async function saveUserTradingSettings(settings: UserTradingSettings): Promise<void> {
  await apiClient.put("/api/user-settings", settings);
}
