import { useEffect, lazy, Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./header";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";
import { fetchUserTradingSettings } from "@/services/user-settings-api";

const ProfitProtectionPanel = lazy(() =>
  import("@/components/terminal/profit-protection-panel").then((m) => ({ default: m.ProfitProtectionPanel }))
);

export function AppLayout() {
  const { pathname } = useLocation();
  const isFullBleed = pathname.startsWith("/terminal") || pathname.startsWith("/charts");

  useEffect(() => {
    fetchUserTradingSettings()
      .then((s) => useUserTradingSettingsStore.getState().setSettings(s))
      .catch(() => {});
  }, []);

  // The PP store is the single source of truth: a non-null pendingOpenBrokerId
  // means "panel open for this broker". onClose clears it.
  const pendingOpenBrokerId = useProfitProtectionStore((s) => s.pendingOpenBrokerId);
  const clearPendingOpen    = useProfitProtectionStore((s) => s.clearPendingOpen);

  return (
    <div className="min-h-svh bg-background">
      <Header />
      <main className={isFullBleed ? undefined : "px-4 py-6 sm:px-6 lg:px-8"}>
        <Outlet />
      </main>
      <Suspense fallback={null}>
        <ProfitProtectionPanel
          open={pendingOpenBrokerId !== null}
          onClose={clearPendingOpen}
          brokerId={pendingOpenBrokerId}
        />
      </Suspense>
    </div>
  );
}
