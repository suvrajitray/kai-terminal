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

    // ── Trading window ───────────────────────────────────────────────────────
    /// <summary>
    /// Time of day when the risk engine begins evaluating. Format: "HH:mm:ss".
    /// Defaults to 09:15:00 (NSE market open).
    /// </summary>
    public TimeSpan TradingWindowStart { get; set; } = new(9, 15, 0);

    /// <summary>
    /// Time of day when the risk engine stops evaluating. Format: "HH:mm:ss".
    /// Defaults to 15:30:00 (NSE market close).
    /// </summary>
    public TimeSpan TradingWindowEnd { get; set; } = new(15, 30, 0);

    /// <summary>
    /// IANA timezone ID used to evaluate trading hours.
    /// Defaults to "Asia/Kolkata" (IST, UTC+5:30).
    /// </summary>
    public string TradingTimeZone { get; set; } = "Asia/Kolkata";

    /// <summary>
    /// Only positions from these exchanges are considered by the risk engine.
    /// An empty list means all exchanges are included.
    /// </summary>
    public List<string> Exchanges { get; set; } = ["NFO", "BFO"];

    // Cached upper-case exchange set — built once on first use; Exchanges is never mutated after config binding.
    private HashSet<string>? _exchangeSet;

    /// <summary>Filters a position list to the configured exchanges (case-insensitive).</summary>
    public IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> FilterPositions(
        IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> positions)
    {
        if (Exchanges.Count == 0) return positions;
        var set = _exchangeSet ??= Exchanges.Select(e => e.ToUpperInvariant()).ToHashSet();
        return positions.Where(p => set.Contains(p.Exchange.ToUpperInvariant())).ToList().AsReadOnly();
    }

}
