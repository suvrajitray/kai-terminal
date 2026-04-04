import { apiClient } from "@/lib/api-client";

export interface UserTradingSettings {
  niftyShiftOffset: number;
  sensexShiftOffset: number;
  bankniftyShiftOffset: number;
  finniftyShiftOffset: number;
  bankexShiftOffset: number;
  indexChangeMode: "open" | "prevClose";
  autoSquareOffEnabled: boolean;
  autoSquareOffTime: string;
}

export const DEFAULT_TRADING_SETTINGS: UserTradingSettings = {
  niftyShiftOffset: 1,
  sensexShiftOffset: 1,
  bankniftyShiftOffset: 1,
  finniftyShiftOffset: 1,
  bankexShiftOffset: 1,
  indexChangeMode: "prevClose",
  autoSquareOffEnabled: false,
  autoSquareOffTime: "15:20",
};

export async function fetchUserTradingSettings(): Promise<UserTradingSettings> {
  const res = await apiClient.get<UserTradingSettings>("/api/user-settings");
  return res.data;
}

export async function saveUserTradingSettings(settings: UserTradingSettings): Promise<void> {
  await apiClient.put("/api/user-settings", settings);
}
