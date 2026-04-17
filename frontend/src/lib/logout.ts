import { useAuthStore } from "@/stores/auth-store";
import { useBrokerStore } from "@/stores/broker-store";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useRiskStateStore } from "@/stores/risk-state-store";
import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";

export function performLogout() {
  const savedTheme = localStorage.getItem("theme-store");
  localStorage.clear();
  if (savedTheme) localStorage.setItem("theme-store", savedTheme);
  useAuthStore.getState().logout();
  useBrokerStore.getState().clearAll();
  useProfitProtectionStore.getState().reset();
  useRiskStateStore.getState().reset();
  useUserTradingSettingsStore.getState().reset();
  useOptionContractsStore.getState().clear();
  window.location.href = "/login";
}
