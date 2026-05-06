export type Direction = "Buy" | "Sell";
export type ActionType = "CE" | "PE" | "BOTH";
export type StrategyMode = "straddle" | "strangle";

export interface ChainRow {
  /** For straddle: ceStrike - atmStrike. For strangle: ceStrike - atmStrike. */
  diff: number;
  ceStrike: number;
  ceLtp?: number;
  ceKey?: string;
  peStrike: number;
  peLtp?: number;
  peKey?: string;
}

