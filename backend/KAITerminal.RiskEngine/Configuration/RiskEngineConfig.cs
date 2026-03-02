using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Configuration;

public sealed class RiskEngineConfig
{
    public const string SectionName = "RiskEngine";

    // ── Portfolio-level thresholds ──────────────────────────────────────────
    public decimal HardStopLoss { get; set; } = -25_000m;
    public decimal ProfitTarget { get; set; } = 25_000m;

    // Trailing SL
    public decimal TrailingActivationThreshold { get; set; } = 5_000m;
    public decimal TrailingInitialLock { get; set; } = 2_000m;
    public decimal TrailingStepGain { get; set; } = 1_000m;
    public decimal TrailingStepLock { get; set; } = 500m;

    // ── Strike-level thresholds ─────────────────────────────────────────────
    public double CeStopLossPercent { get; set; } = 0.20;
    public double PeStopLossPercent { get; set; } = 0.30;
    public int StrikeGap { get; set; } = 100;
    public int MaxReentries { get; set; } = 2;

    // ── Loop intervals ──────────────────────────────────────────────────────
    public int PortfolioCheckIntervalSeconds { get; set; } = 60;
    public int StrikeCheckIntervalSeconds { get; set; } = 5;

    // ── Multi-user config (used by Worker via ConfigTokenSource) ────────────
    public List<UserConfig> Users { get; set; } = [];
}
