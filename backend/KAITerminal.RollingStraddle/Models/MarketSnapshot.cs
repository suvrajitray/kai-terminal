namespace KAITerminal.RollingStraddle.Models;

internal sealed record MarketSnapshot(
    decimal  Spot,
    decimal  Pnl,
    decimal  CeLtp,
    decimal  PeLtp,
    TimeSpan TimeOfDay);
