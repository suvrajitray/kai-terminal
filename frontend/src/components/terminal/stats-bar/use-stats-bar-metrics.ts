import { useMemo } from "react";
import type { Position } from "@/types";
import { useSessionExtremes } from "./use-session-extremes";

export function useStatsBarMetrics(
  positions: Position[],
  productFilter: "Intraday" | "Delivery" | null,
) {
  const displayPositions = useMemo(
    () => productFilter ? positions.filter((position) => position.product === productFilter) : positions,
    [positions, productFilter],
  );

  const openCount = useMemo(
    () => displayPositions.filter((position) => position.quantity !== 0).length,
    [displayPositions],
  );
  const closedCount = useMemo(
    () => displayPositions.filter((position) => position.quantity === 0).length,
    [displayPositions],
  );
  const totalPnl = useMemo(
    () => displayPositions.reduce((sum, position) => sum + position.pnl, 0),
    [displayPositions],
  );
  const allPnl = useMemo(
    () => positions.reduce((sum, position) => sum + position.pnl, 0),
    [positions],
  );
  const { maxProfit, maxLoss } = useSessionExtremes(allPnl, positions.length > 0);

  return {
    displayPositions,
    openCount,
    closedCount,
    totalPnl,
    maxProfit,
    maxLoss,
  };
}

