import { useAuthStore } from "@/stores/auth-store";
import { useBrokerStore } from "@/stores/broker-store";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useRiskStateStore } from "@/stores/risk-state-store";
import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";

/**
 * Clears all auth and app state, then redirects to /login.
 * Safe to call outside React components (e.g. API interceptors).
 *
 * localStorage is cleared FIRST so that Zustand persist subscribers
 * cannot write stale state back after the clear. Theme preference is
 * intentionally preserved: saved before the clear and restored after,
 * so the user's light/dark choice survives logout.
 */
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
