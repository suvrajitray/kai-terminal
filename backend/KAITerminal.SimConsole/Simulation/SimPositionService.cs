using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Upstox.Services;
using Microsoft.Extensions.Logging;

namespace KAITerminal.SimConsole.Simulation;

/// <summary>
/// Simulates total PnL with a random walk. No real positions — just a number that
/// moves ±<see cref="MaxStep"/> each tick so the risk engine has something to evaluate.
/// Auto-resets 12 seconds after a square-off so the engine cycles indefinitely.
/// </summary>
public sealed class SimPositionService : IPositionService
{
    private const decimal MaxStep       = 1500m;
    private const int     ResetDelaySec = 12;

    private decimal   _pnl;
    private bool      _squaredOff;
    private DateTime? _resetAt;

    private readonly Random                      _rng  = new();
    private readonly IRiskRepository             _repo;
    private readonly ILogger<SimPositionService> _logger;

    public SimPositionService(IRiskRepository repo, ILogger<SimPositionService> logger)
    {
        _repo   = repo;
        _logger = logger;
    }

    public Task<decimal> GetTotalMtmAsync(CancellationToken cancellationToken = default)
    {
        if (_resetAt.HasValue && DateTime.UtcNow >= _resetAt.Value)
            Reset();

        if (!_squaredOff)
            _pnl += (decimal)(_rng.NextDouble() * 2 - 1) * MaxStep;

        return Task.FromResult(_pnl);
    }

    public Task<IReadOnlyList<string>> ExitAllPositionsAsync(
        CancellationToken cancellationToken = default)
    {
        _squaredOff = true;
        _resetAt    = DateTime.UtcNow.AddSeconds(ResetDelaySec);
        _logger.LogInformation("[SIM] Squared off at PnL={Pnl:+0;-0} — new cycle in {Delay}s", _pnl, ResetDelaySec);
        return Task.FromResult<IReadOnlyList<string>>(["SIM-EXIT-ALL"]);
    }

    // Strike monitor is not used in this simulation — return empty list.
    public Task<IReadOnlyList<Position>> GetAllPositionsAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<Position>>([]);

    public Task<string> ExitPositionAsync(
        string instrumentToken,
        string product,
        CancellationToken cancellationToken = default)
        => Task.FromResult($"SIM-EXIT-{instrumentToken}");

    private void Reset()
    {
        _pnl        = 0m;
        _squaredOff = false;
        _resetAt    = null;
        _repo.Reset("sim-user");
        _logger.LogInformation("[SIM] ── New cycle started ──");
    }
}
