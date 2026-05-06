import type { OptionChainEntry } from "@/types";

export function calculateMaxPain(chain: OptionChainEntry[]): number | null {
  if (chain.length === 0) return null;
  let minPain = Infinity;
  let mpStrike = 0;
  for (const row of chain) {
    const S = row.strikePrice;
    let pain = 0;
    for (const r of chain) {
      const K = r.strikePrice;
      const callOi = r.callOptions?.marketData?.oi ?? 0;
      const putOi  = r.putOptions?.marketData?.oi  ?? 0;
      if (K <= S) pain += (S - K) * callOi;
      if (K >= S) pain += (K - S) * putOi;
    }
    if (pain < minPain) { minPain = pain; mpStrike = S; }
  }
  return mpStrike > 0 ? mpStrike : null;
}

export function calculatePcr(chain: OptionChainEntry[]): number | null {
  const totalCallOi = chain.reduce((s, e) => s + (e.callOptions?.marketData?.oi ?? 0), 0);
  const totalPutOi  = chain.reduce((s, e) => s + (e.putOptions?.marketData?.oi  ?? 0), 0);
  return totalCallOi > 0 ? totalPutOi / totalCallOi : null;
}

export function calculateAtmIv(chain: OptionChainEntry[], atmStrike: number): number | null {
  const atmEntry = atmStrike > 0 ? chain.find((e) => e.strikePrice === atmStrike) : undefined;
  const callIv   = atmEntry?.callOptions?.optionGreeks?.iv ?? 0;
  const putIv    = atmEntry?.putOptions?.optionGreeks?.iv  ?? 0;
  if (callIv > 0 && putIv > 0) return (callIv + putIv) / 2;
  if (callIv > 0) return callIv;
  if (putIv > 0)  return putIv;
  return null;
}

export function calculateExpectedMove(
  chain: OptionChainEntry[],
  atmStrike: number,
  spotPrice: number,
): { pct: number | null; pts: number | null } {
  const atmEntry        = atmStrike > 0 ? chain.find((e) => e.strikePrice === atmStrike) : undefined;
  const atmCallLtp      = atmEntry?.callOptions?.marketData?.ltp ?? 0;
  const atmPutLtp       = atmEntry?.putOptions?.marketData?.ltp  ?? 0;
  const straddlePremium = atmCallLtp > 0 && atmPutLtp > 0 ? atmCallLtp + atmPutLtp : 0;
  return {
    pct: spotPrice > 0 && straddlePremium > 0 ? (straddlePremium / spotPrice) * 100 : null,
    pts: straddlePremium > 0 ? straddlePremium : null,
  };
}

export function calculateIvRankMetrics(
  atmIv: number | null,
  ivHistory: Array<{ atmIv: number }>,
): { ivRank: number | null; ivPercentile: number | null } {
  if (ivHistory.length < 2 || atmIv === null) return { ivRank: null, ivPercentile: null };
  const ivs = ivHistory.map((s) => s.atmIv);
  const lo  = Math.min(...ivs);
  const hi  = Math.max(...ivs);
  return {
    ivRank:       hi > lo ? ((atmIv - lo) / (hi - lo)) * 100 : null,
    ivPercentile: (ivs.filter((v) => v < atmIv).length / ivs.length) * 100,
  };
}
