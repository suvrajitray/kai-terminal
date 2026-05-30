using KAITerminal.RiskEngine.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Workers;

/// <summary>
/// Tracks whether the current IST time is inside the configured trading window and
/// emits one Information log line each time the window transitions open/closed.
/// Thread-safe — the transition latch uses <see cref="Interlocked.Exchange"/>.
/// </summary>
public sealed class TradingWindow
{
    private readonly RiskEngineConfig         _cfg;
    private readonly TimeZoneInfo             _tz;
    private readonly ILogger<TradingWindow>   _logger;

    private int _state = -1; // 0 = closed, 1 = open, -1 = uninitialised

    public TradingWindow(
        IOptions<RiskEngineConfig> cfg,
        ILogger<TradingWindow>     logger)
    {
        _cfg    = cfg.Value;
        _tz     = TimeZoneInfo.FindSystemTimeZoneById(_cfg.TradingTimeZone);
        _logger = logger;
    }

    public bool IsOpen()
    {
        var now      = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, _tz).TimeOfDay;
        bool inWindow = now >= _cfg.TradingWindowStart && now <= _cfg.TradingWindowEnd;

        var newState = inWindow ? 1 : 0;
        var prev     = Interlocked.Exchange(ref _state, newState);
        if (prev != newState) LogTransition(inWindow);

        return inWindow;
    }

    private void LogTransition(bool open)
    {
        if (open)
            _logger.LogInformation("[MKT  ] Open — risk engine active  |  {Start}–{End} {Tz}",
                _cfg.TradingWindowStart.ToString(@"hh\:mm"),
                _cfg.TradingWindowEnd.ToString(@"hh\:mm"),
                _cfg.TradingTimeZone);
        else
            _logger.LogInformation("[MKT  ] Closed — paused until {Start} {Tz}",
                _cfg.TradingWindowStart.ToString(@"hh\:mm"),
                _cfg.TradingTimeZone);
    }
}
