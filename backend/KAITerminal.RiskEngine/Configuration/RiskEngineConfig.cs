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

    // ── Loop intervals ──────────────────────────────────────────────────────
    public int PortfolioCheckIntervalSeconds { get; set; } = 60;
    public int StrikeCheckIntervalSeconds    { get; set; } = 5;

    // ── Multi-user config (used by Worker via ConfigTokenSource) ────────────
    public List<UserConfig> Users { get; set; } = [];
}
