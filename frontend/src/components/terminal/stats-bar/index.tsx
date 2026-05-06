import { lazy, Suspense, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Position } from "@/types";
import { BROKERS } from "@/lib/constants";
import { useRiskConfig } from "@/hooks/use-risk-config";
import { useBrokerStore } from "@/stores/broker-store";
import { StatsActions } from "./stats-actions";
import { StatsSummary } from "./stats-summary";
import { useStatsBarMetrics } from "./use-stats-bar-metrics";
import type { PpBrokerEntry } from "./types";

const PayoffChartDialog = lazy(() =>
  import("../payoff-chart-dialog").then((module) => ({ default: module.PayoffChartDialog }))
);

export type { PpBrokerEntry } from "./types";

interface StatsBarProps {
  positions: Position[];
  isLive: boolean;
  loading: boolean;
  acting: string | null;
  onRefresh: () => void;
  onExitAll: () => void;
  onOpenProfitProtection: (brokerId?: string) => void;
  ppBrokers: PpBrokerEntry[];
  onToggleChain: () => void;
  chainOpen: boolean;
  productFilter: "Intraday" | "Delivery" | null;
}

export function StatsBar({
  positions,
  isLive,
  loading,
  acting,
  onRefresh,
  onExitAll,
  onOpenProfitProtection,
  ppBrokers,
  onToggleChain,
  chainOpen,
  productFilter,
}: StatsBarProps) {
  const connectedBrokers = useBrokerStore(useShallow((state) =>
    BROKERS.filter((broker) => state.isAuthenticated(broker.id)),
  ));
  const singleBroker = connectedBrokers[0]?.id ?? "upstox";
  const { setEnabled } = useRiskConfig(singleBroker);
  const ppEnabled = ppBrokers.length > 0;
  const [payoffOpen, setPayoffOpen] = useState(false);
  const {
    displayPositions,
    openCount,
    closedCount,
    totalPnl,
    maxProfit,
    maxLoss,
  } = useStatsBarMetrics(positions, productFilter);

  return (
    <div className="flex flex-col lg:flex-row shrink-0 border-b border-border bg-muted/40 px-3">
      <StatsSummary
        isLive={isLive}
        hasPositions={displayPositions.length > 0}
        totalPnl={totalPnl}
        openCount={openCount}
        closedCount={closedCount}
        maxProfit={maxProfit}
        maxLoss={maxLoss}
        productFilter={productFilter}
        ppBrokers={ppBrokers}
      />

      <StatsActions
        connectedBrokers={connectedBrokers}
        ppEnabled={ppEnabled}
        openCount={openCount}
        acting={acting}
        loading={loading}
        chainOpen={chainOpen}
        onOpenProfitProtection={onOpenProfitProtection}
        onToggleProfitProtection={() => setEnabled(!ppEnabled)}
        onExitAll={onExitAll}
        onRefresh={onRefresh}
        onOpenPayoff={() => setPayoffOpen(true)}
        onToggleChain={onToggleChain}
      />

      <Suspense fallback={null}>
        <PayoffChartDialog
          open={payoffOpen}
          onOpenChange={setPayoffOpen}
          positions={positions}
        />
      </Suspense>
    </div>
  );
}

