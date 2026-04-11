using System.Collections.Concurrent;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using Microsoft.Extensions.Logging;

namespace KAITerminal.RiskEngine.Workers;

internal sealed class UserSessionRegistry
{
    private readonly IRiskRepository                              _repo;
    private readonly ILogger                                     _logger;
    private readonly Action<string>                              _onSessionRemoved;
    private readonly Func<UserConfig, CancellationToken, Task>   _sessionFactory;
    private readonly ConcurrentDictionary<string, SessionEntry>  _sessions = new(StringComparer.Ordinal);

    public IReadOnlyCollection<SessionEntry> AllSessions => (IReadOnlyCollection<SessionEntry>)_sessions.Values;

    internal sealed class SessionEntry
    {
        public required CancellationTokenSource Cts    { get; init; }
        public required Task                    Task   { get; init; }
        public required UserConfig              Config { get; init; }
    }

    public UserSessionRegistry(
        IRiskRepository                            repo,
        ILogger                                    logger,
        Action<string>                             onSessionRemoved,
        Func<UserConfig, CancellationToken, Task>  sessionFactory)
    {
        _repo             = repo;
        _logger           = logger;
        _onSessionRemoved = onSessionRemoved;
        _sessionFactory   = sessionFactory;
    }

    private static string Key(UserConfig u) => $"{u.UserId}::{u.BrokerType}";

    public async Task SyncSessionsAsync(IReadOnlyList<UserConfig> freshUsers, CancellationToken stoppingToken)
    {
        var freshByKey = freshUsers.ToDictionary(Key, StringComparer.Ordinal);

        var toStop = _sessions
            .Where(kvp => !freshByKey.TryGetValue(kvp.Key, out var fresh) || HasConfigChanged(kvp.Value.Config, fresh))
            .ToList();

        foreach (var (key, entry) in toStop)
        {
            bool configChanged = freshByKey.ContainsKey(key);
            _logger.LogInformation(
                "Stopping session ({Reason}) — {UserId} ({Broker})",
                configChanged ? "config changed" : "disabled or token expired",
                entry.Config.UserId, entry.Config.BrokerType);
            entry.Cts.Cancel();
            _sessions.TryRemove(key, out _);
            _onSessionRemoved(key);

            if (configChanged)
                await _repo.ResetAsync(key);
        }

        if (toStop.Count > 0)
            await Task.WhenAll(toStop.Select(x => x.Value.Task));

        foreach (var user in freshUsers)
        {
            if (_sessions.ContainsKey(Key(user))) continue;

            _logger.LogInformation("Starting session — {UserId} ({Broker})", user.UserId, user.BrokerType);
            var cts  = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            var task = _sessionFactory(user, cts.Token);
            _sessions[Key(user)] = new SessionEntry { Cts = cts, Task = task, Config = user };
        }
    }

    private static bool HasConfigChanged(UserConfig old, UserConfig next) =>
        old.AccessToken           != next.AccessToken           ||
        old.ApiKey                != next.ApiKey                ||
        old.MtmTarget             != next.MtmTarget             ||
        old.MtmSl                 != next.MtmSl                 ||
        old.TrailingEnabled       != next.TrailingEnabled       ||
        old.TrailingActivateAt    != next.TrailingActivateAt    ||
        old.LockProfitAt          != next.LockProfitAt          ||
        old.WhenProfitIncreasesBy != next.WhenProfitIncreasesBy ||
        old.IncreaseTrailingBy    != next.IncreaseTrailingBy    ||
        old.AutoShiftEnabled      != next.AutoShiftEnabled      ||
        old.AutoShiftThresholdPct != next.AutoShiftThresholdPct ||
        old.AutoShiftMaxCount     != next.AutoShiftMaxCount     ||
        old.AutoShiftStrikeGap    != next.AutoShiftStrikeGap    ||
        old.AutoSquareOffEnabled  != next.AutoSquareOffEnabled  ||
        old.AutoSquareOffTime     != next.AutoSquareOffTime     ||
        old.WatchedProducts       != next.WatchedProducts;
}
