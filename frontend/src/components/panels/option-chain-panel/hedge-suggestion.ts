import type { OptionChainEntry } from "@/types";

export interface HedgeSuggestion {
  side: "CE" | "PE";
  strike: number;
  lots: number;
  ltp: number;
  residualDelta: number;
}

export function calculateHedgeSuggestion({
  netDelta,
  atmStrike,
  visibleRows,
  lotSize,
}: {
  netDelta?: number;
  atmStrike: number;
  visibleRows: OptionChainEntry[];
  lotSize: number;
}): HedgeSuggestion | null {
  if (netDelta === undefined || atmStrike === 0 || visibleRows.length === 0) return null;

  const threshold = lotSize * 0.15;
  if (Math.abs(netDelta) < threshold) return null;

  const needPositiveDelta = netDelta < 0;
  const side = needPositiveDelta ? "PE" : "CE";
  const targetDeltaPerShare = Math.abs(netDelta) / lotSize;
  const candidates = visibleRows
    .map((row) => {
      const option = needPositiveDelta ? row.putOptions : row.callOptions;
      const delta = Math.abs(option?.optionGreeks?.delta ?? 0);
      const ltp = option?.marketData?.ltp ?? 0;
      return { strike: row.strikePrice, delta, ltp };
    })
    .filter((candidate) => candidate.delta >= 0.15 && candidate.delta <= 0.65);

  if (candidates.length === 0) return null;

  const best = candidates.reduce((prev, curr) =>
    Math.abs(curr.delta - targetDeltaPerShare) < Math.abs(prev.delta - targetDeltaPerShare) ? curr : prev,
  );
  const lots = Math.max(1, Math.round(Math.abs(netDelta) / (best.delta * lotSize)));
  const residualDelta = netDelta + (needPositiveDelta ? 1 : -1) * best.delta * lots * lotSize;

  return { side, strike: best.strike, lots, ltp: best.ltp, residualDelta };
}

