import { useState, useEffect, lazy, Suspense } from "react";
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

  const pendingOpenBrokerId = useProfitProtectionStore((s) => s.pendingOpenBrokerId);
  const [ppOpen, setPpOpen] = useState(false);
  const [ppBrokerId, setPpBrokerId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingOpenBrokerId) {
      setPpBrokerId(pendingOpenBrokerId);
      setPpOpen(true);
      useProfitProtectionStore.getState().clearPendingOpen();
    }
  }, [pendingOpenBrokerId]);

  return (
    <div className="min-h-svh bg-background">
      <Header />
      <main className={isFullBleed ? undefined : "px-4 py-6 sm:px-6 lg:px-8"}>
        <Outlet />
      </main>
      <Suspense fallback={null}>
        <ProfitProtectionPanel
          open={ppOpen}
          onClose={() => { setPpOpen(false); setPpBrokerId(null); }}
          brokerId={ppBrokerId}
        />
      </Suspense>
    </div>
  );
}
