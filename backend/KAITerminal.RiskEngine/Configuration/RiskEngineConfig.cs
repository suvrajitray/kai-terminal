namespace KAITerminal.RiskEngine.Configuration;

public sealed class RiskEngineConfig
{
    public const string SectionName = "RiskEngine";

    // ── Portfolio-level thresholds ──────────────────────────────────────────
    public decimal OverallStopLoss  { get; set; } = -25_000m;
    public decimal ProfitTarget  { get; set; } =  25_000m;

    // Trailing SL
    /// <summary>MTM level at which trailing SL activates.</summary>
    public decimal TrailingActivateAt         { get; set; } = 5_000m;
    /// <summary>The trailing stop is locked at this fixed profit when TSL first activates.</summary>
    public decimal LockProfitAt          { get; set; } = 2_000m;
    /// <summary>How much MTM must gain from the last step before the stop is raised.</summary>
    public decimal WhenProfitIncreasesBy { get; set; } = 1_000m;
    /// <summary>How much the trailing stop rises each time the profit step is crossed.</summary>
    public decimal IncreaseTrailingBy         { get; set; } =   500m;

    // ── Feature flags ───────────────────────────────────────────────────────
    public bool EnableTrailingStopLoss { get; set; } = true;

    /// <summary>
    /// Minimum milliseconds between portfolio risk evaluations triggered by LTP ticks.
    /// Portfolio-event-triggered evaluations (order/position fills) always run immediately.
    /// </summary>
    public int LtpEvalMinIntervalMs { get; set; } = 15_000;

    /// <summary>
    /// Only positions from these exchanges are considered by the risk engine.
    /// An empty list means all exchanges are included.
    /// </summary>
    public List<string> Exchanges { get; set; } = ["NFO", "BFO"];

    /// <summary>Filters a position list to the configured exchanges (case-insensitive).</summary>
    public IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> FilterPositions(
        IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> positions)
    {
        if (Exchanges.Count == 0) return positions;
        var set = Exchanges.Select(e => e.ToUpperInvariant()).ToHashSet();
        return positions.Where(p => set.Contains(p.Exchange.ToUpperInvariant())).ToList().AsReadOnly();
    }

}
