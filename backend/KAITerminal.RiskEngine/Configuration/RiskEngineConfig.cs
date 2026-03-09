using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Configuration;

public sealed class RiskEngineConfig
{
    public const string SectionName = "RiskEngine";

    // ── Portfolio-level thresholds ──────────────────────────────────────────
    public decimal HardStopLoss  { get; set; } = -25_000m;
    public decimal ProfitTarget  { get; set; } =  25_000m;

    // Trailing SL
    /// <summary>MTM level at which trailing SL activates.</summary>
    public decimal TSLActivateAt         { get; set; } = 5_000m;
    /// <summary>The trailing stop is locked at this fixed profit when TSL first activates.</summary>
    public decimal LockProfitAt          { get; set; } = 2_000m;
    /// <summary>How much MTM must gain from the last step before the stop is raised.</summary>
    public decimal WhenProfitIncreasesBy { get; set; } = 1_000m;
    /// <summary>How much the trailing stop rises each time the profit step is crossed.</summary>
    public decimal IncreaseTSLBy         { get; set; } =   500m;

    // ── Strike-level thresholds ─────────────────────────────────────────────
    public double CeStopLossPercent { get; set; } = 0.20;
    public double PeStopLossPercent { get; set; } = 0.30;
    public int    StrikeGap         { get; set; } = 100;
    public int    MaxReentries      { get; set; } = 2;

    // ── Feature flags ───────────────────────────────────────────────────────
    public bool EnableTrailingStopLoss { get; set; } = true;
    public bool EnableStrikeWorker     { get; set; } = true;

    /// <summary>
    /// When true, <see cref="StreamingRiskWorker"/> is used instead of the two interval-based workers.
    /// The risk engine reacts to Upstox WebSocket events rather than polling on a timer.
    /// </summary>
    public bool EnableStreamingMode { get; set; } = false;

    /// <summary>
    /// Minimum milliseconds between portfolio risk evaluations triggered by LTP ticks.
    /// Portfolio-event-triggered evaluations (order/position fills) always run immediately.
    /// </summary>
    public int LtpEvalMinIntervalMs { get; set; } = 500;

    // ── Loop intervals (interval-based mode only) ───────────────────────────
    public int PortfolioCheckIntervalSeconds { get; set; } = 60;
    public int StrikeCheckIntervalSeconds    { get; set; } = 5;

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

    // ── Multi-user config (used by Worker via ConfigTokenSource) ────────────
    public List<UserConfig> Users { get; set; } = [];
}
