import { motion } from "motion/react";
import { usePositionsFeed } from "@/components/panels/positions-panel/use-positions-feed";
import { StatCard, CountCard } from "@/components/dashboard/stat-card";
import { IndexOverview } from "@/components/dashboard/index-overview";
import { PositionsMiniTable } from "@/components/dashboard/positions-mini-table";
import { DayExtremesCard } from "@/components/dashboard/day-extremes-card";
import { PpStatusCard } from "@/components/dashboard/pp-status-card";
import { useRiskConfig } from "@/hooks/use-risk-config";

export function DashboardPage() {
  // One call per known broker — add a line here when integrating a new broker.
  useRiskConfig("upstox");
  useRiskConfig("zerodha");
  useRiskConfig("dhan");
  const { positions, loading } = usePositionsFeed();

  const hasPositions = positions.length > 0;
  const totalPnl        = hasPositions ? positions.reduce((s, p) => s + p.pnl, 0) : null;
  const openCount = hasPositions ? positions.filter((p) => p.quantity !== 0).length : null;

  return (
    <div className="space-y-6 p-1">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="text-xl font-semibold"
      >
        Dashboard
      </motion.h1>

      {/* Row 1 — Stat Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Today's MTM"     value={totalPnl}  index={0} colored flash prefix="₹" loading={loading} />
        <CountCard label="Open Positions" value={openCount} index={1} loading={loading} />
      </div>

      {/* Row 2 — Index Cards */}
      <IndexOverview />

      {/* Row 3 — Mini-table + Right column */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <PositionsMiniTable positions={positions} loading={loading} />

        <div className="flex flex-col gap-4">
          <DayExtremesCard positions={positions} />
          <PpStatusCard />
        </div>
      </div>
    </div>
  );
}
