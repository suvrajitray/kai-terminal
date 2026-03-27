using KAITerminal.Broker;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Abstractions;

/// <summary>
/// Per-position auto-shift evaluator. Checked on every risk tick for each sell position.
/// The default implementation is <c>NullAutoShiftEvaluator</c> (no-op).
/// The real implementation lives in <c>KAITerminal.Worker</c> (has MarketData deps)
/// and is registered before <c>AddRiskEngine</c> so TryAddSingleton does not override it.
/// </summary>
public interface IAutoShiftEvaluator
{
    Task EvaluateAsync(string userId, UserConfig config, IBrokerClient broker, CancellationToken ct);
}
