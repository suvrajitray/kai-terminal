using KAITerminal.Contracts.Domain;

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

    /// <summary>How often (ms) positions are re-fetched via REST to detect fills and update the cache.</summary>
    public int PositionPollIntervalMs { get; set; } = 30_000;

    /// <summary>
    /// How often (ms) the supervisor re-queries the DB for user/config changes.
    /// New users are started, removed users are stopped, and config changes trigger a session restart.
    /// </summary>
    public int UserRefreshIntervalMs { get; set; } = 60_000;

    // ── Trading window ───────────────────────────────────────────────────────
    public TimeSpan TradingWindowStart { get; set; } = new(9, 15, 0);
    public TimeSpan TradingWindowEnd   { get; set; } = new(15, 30, 0);
    public string   TradingTimeZone    { get; set; } = "Asia/Kolkata";

    /// <summary>
    /// Only positions from these exchanges are considered by the risk engine.
    /// An empty list means all exchanges are included.
    /// </summary>
    public List<string> Exchanges { get; set; } = ["NFO", "BFO"];

    // Cached upper-case exchange set — built once on first use
    private HashSet<string>? _exchangeSet;

    /// <summary>Filters a position list to the configured exchanges (case-insensitive).</summary>
    public IReadOnlyList<Position> FilterPositions(IReadOnlyList<Position> positions)
    {
        if (Exchanges.Count == 0) return positions;
        var set = _exchangeSet ??= Exchanges.Select(e => e.ToUpperInvariant()).ToHashSet();
        return positions.Where(p => set.Contains(p.Exchange.ToUpperInvariant())).ToList().AsReadOnly();
    }
}
