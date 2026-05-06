import { useMemo } from "react";
import type { Position } from "@/types";

export function usePositionGreeksSummary({
  netDelta,
  thetaPerDay,
  openPositions,
}: {
  netDelta?: number;
  thetaPerDay: number;
  openPositions: Position[];
}) {
  const thetaEarnedToday = useMemo(() => {
    if (!thetaPerDay) return 0;

    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const totalMinutes = ist.getHours() * 60 + ist.getMinutes();
    const marketOpenMinutes = 9 * 60 + 15;

    if (totalMinutes < marketOpenMinutes) return 0;

    const elapsed = Math.min(totalMinutes - marketOpenMinutes, 375);
    return thetaPerDay * (elapsed / 375);
  }, [thetaPerDay]);

  const showGreeks = netDelta !== undefined && openPositions.length > 0 && (netDelta !== 0 || thetaPerDay !== 0);

  return { thetaEarnedToday, showGreeks };
}

