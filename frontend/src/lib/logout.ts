import { useAuthStore } from "@/stores/auth-store";
import { useBrokerStore } from "@/stores/broker-store";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";

/**
 * Clears all auth and app state, then redirects to /login.
 * Safe to call outside React components (e.g. API interceptors).
 */
export function performLogout() {
  useAuthStore.getState().logout();
  useBrokerStore.getState().clearAll();
  useProfitProtectionStore.getState().reset();
  useUserTradingSettingsStore.getState().reset();
  localStorage.clear();
  window.location.href = "/login";
}
