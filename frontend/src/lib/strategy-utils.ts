import type { ContractEntry } from "@/types";

export interface StrategyLeg {
  upstoxToken: string;
  strikePrice: number;
  side: "CE" | "PE";
  transactionType: "Buy" | "Sell";
}

export type Strategy = "Straddle" | "Strangle" | "IronCondor";

export function getAtmIndex(strikes: number[], spot: number): number {
  let best = 0;
  for (let i = 1; i < strikes.length; i++) {
    const distI    = Math.abs(strikes[i]    - spot);
    const distBest = Math.abs(strikes[best] - spot);
    // tie-break: prefer the higher strike (standard ATM convention)
    if (distI < distBest || (distI === distBest && strikes[i] > strikes[best])) best = i;
  }
  return best;
}

export function computeLegs(
  contracts: ContractEntry[],
  expiry: string,
  spot: number,
  strategy: Strategy,
  sellWidth: number,
  hedgeWidth: number,
): StrategyLeg[] | null {
  const ces = contracts
    .filter((c) => c.expiry === expiry && c.instrumentType === "CE" && c.upstoxToken !== "")
    .sort((a, b) => a.strikePrice - b.strikePrice);
  const pes = contracts
    .filter((c) => c.expiry === expiry && c.instrumentType === "PE" && c.upstoxToken !== "")
    .sort((a, b) => a.strikePrice - b.strikePrice);

  if (ces.length === 0 || pes.length === 0) return null;

  const atmCe = getAtmIndex(ces.map((c) => c.strikePrice), spot);
  const atmPe = getAtmIndex(pes.map((c) => c.strikePrice), spot);

  if (strategy === "Straddle") {
    const ce = ces[atmCe];
    const pe = pes[atmPe];
    if (!ce || !pe) return null;
    return [
      { upstoxToken: ce.upstoxToken, strikePrice: ce.strikePrice, side: "CE", transactionType: "Sell" },
      { upstoxToken: pe.upstoxToken, strikePrice: pe.strikePrice, side: "PE", transactionType: "Sell" },
    ];
  }

  if (strategy === "Strangle") {
    const ceIdx = atmCe + sellWidth;
    const peIdx = atmPe - sellWidth;
    if (ceIdx >= ces.length || peIdx < 0) return null;
    return [
      { upstoxToken: ces[ceIdx].upstoxToken, strikePrice: ces[ceIdx].strikePrice, side: "CE", transactionType: "Sell" },
      { upstoxToken: pes[peIdx].upstoxToken, strikePrice: pes[peIdx].strikePrice, side: "PE", transactionType: "Sell" },
    ];
  }

  // IronCondor
  const sellCeIdx = atmCe + sellWidth;
  const buyCeIdx  = sellCeIdx + hedgeWidth;
  const sellPeIdx = atmPe - sellWidth;
  const buyPeIdx  = sellPeIdx - hedgeWidth;
  if (buyCeIdx >= ces.length || buyPeIdx < 0) return null;
  return [
    { upstoxToken: ces[sellCeIdx].upstoxToken, strikePrice: ces[sellCeIdx].strikePrice, side: "CE", transactionType: "Sell" },
    { upstoxToken: ces[buyCeIdx].upstoxToken,  strikePrice: ces[buyCeIdx].strikePrice,  side: "CE", transactionType: "Buy"  },
    { upstoxToken: pes[sellPeIdx].upstoxToken, strikePrice: pes[sellPeIdx].strikePrice, side: "PE", transactionType: "Sell" },
    { upstoxToken: pes[buyPeIdx].upstoxToken,  strikePrice: pes[buyPeIdx].strikePrice,  side: "PE", transactionType: "Buy"  },
  ];
}
