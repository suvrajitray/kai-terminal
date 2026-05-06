import { SessionTimer } from "../session-timer";
import { MtmDisplay } from "../mtm-display";
import { PositionCountBadges } from "../position-count-badges";
import { LiveStatus } from "./live-status";
import { ProductFilterPill } from "./product-filter-pill";
import { ProfitProtectionTargets } from "./profit-protection-targets";
import { SessionExtremes } from "./session-extremes";
import type { PpBrokerEntry } from "./types";

interface StatsSummaryProps {
  isLive: boolean;
  hasPositions: boolean;
  totalPnl: number;
  openCount: number;
  closedCount: number;
  maxProfit: number | null;
  maxLoss: number | null;
  productFilter: "Intraday" | "Delivery" | null;
  ppBrokers: PpBrokerEntry[];
}

export function StatsSummary({
  isLive,
  hasPositions,
  totalPnl,
  openCount,
  closedCount,
  maxProfit,
  maxLoss,
  productFilter,
  ppBrokers,
}: StatsSummaryProps) {
  return (
    <div className="flex h-9 items-center gap-2 flex-1 min-w-0 overflow-hidden">
      <LiveStatus isLive={isLive} />
      <SessionTimer />

      {hasPositions && (
        <>
          <MtmDisplay value={totalPnl} />
          {productFilter && <ProductFilterPill productFilter={productFilter} />}
          <PositionCountBadges openCount={openCount} closedCount={closedCount} />
          <SessionExtremes maxProfit={maxProfit} maxLoss={maxLoss} />
        </>
      )}

      <ProfitProtectionTargets ppBrokers={ppBrokers} />
    </div>
  );
}

