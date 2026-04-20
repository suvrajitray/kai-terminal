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
            bool configChanged = freshByKey.TryGetValue(key, out var fresh);
            if (configChanged && fresh is not null)
            {
                var changedFields = DescribeConfigChanges(entry.Config, fresh);
                _logger.LogInformation(
                    "Stopping session (config changed: {Changes}) — {UserId} ({Broker})",
                    changedFields, entry.Config.UserId, entry.Config.BrokerType);
                await _repo.ResetAsync(key);
            }
            else
            {
                _logger.LogInformation(
                    "Stopping session (disabled or token expired) — {UserId} ({Broker})",
                    entry.Config.UserId, entry.Config.BrokerType);
            }
            entry.Cts.Cancel();
            _sessions.TryRemove(key, out _);
            _onSessionRemoved(key);
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

    private static string DescribeConfigChanges(UserConfig old, UserConfig next)
    {
        var changes = new List<string>();
        if (old.AccessToken           != next.AccessToken)           changes.Add("AccessToken");
        if (old.ApiKey                != next.ApiKey)                changes.Add("ApiKey");
        if (old.MtmTarget             != next.MtmTarget)             changes.Add($"MtmTarget {old.MtmTarget}→{next.MtmTarget}");
        if (old.MtmSl                 != next.MtmSl)                 changes.Add($"MtmSl {old.MtmSl}→{next.MtmSl}");
        if (old.TrailingEnabled       != next.TrailingEnabled)       changes.Add($"TrailingEnabled {old.TrailingEnabled}→{next.TrailingEnabled}");
        if (old.TrailingActivateAt    != next.TrailingActivateAt)    changes.Add($"TrailingActivateAt {old.TrailingActivateAt}→{next.TrailingActivateAt}");
        if (old.LockProfitAt          != next.LockProfitAt)          changes.Add($"LockProfitAt {old.LockProfitAt}→{next.LockProfitAt}");
        if (old.WhenProfitIncreasesBy != next.WhenProfitIncreasesBy) changes.Add($"WhenProfitIncreasesBy {old.WhenProfitIncreasesBy}→{next.WhenProfitIncreasesBy}");
        if (old.IncreaseTrailingBy    != next.IncreaseTrailingBy)    changes.Add($"IncreaseTrailingBy {old.IncreaseTrailingBy}→{next.IncreaseTrailingBy}");
        if (old.AutoShiftEnabled      != next.AutoShiftEnabled)      changes.Add($"AutoShiftEnabled {old.AutoShiftEnabled}→{next.AutoShiftEnabled}");
        if (old.AutoShiftThresholdPct != next.AutoShiftThresholdPct) changes.Add($"AutoShiftThresholdPct {old.AutoShiftThresholdPct}→{next.AutoShiftThresholdPct}");
        if (old.AutoShiftMaxCount     != next.AutoShiftMaxCount)     changes.Add($"AutoShiftMaxCount {old.AutoShiftMaxCount}→{next.AutoShiftMaxCount}");
        if (old.AutoShiftStrikeGap    != next.AutoShiftStrikeGap)    changes.Add($"AutoShiftStrikeGap {old.AutoShiftStrikeGap}→{next.AutoShiftStrikeGap}");
        if (old.AutoSquareOffEnabled  != next.AutoSquareOffEnabled)  changes.Add($"AutoSquareOffEnabled {old.AutoSquareOffEnabled}→{next.AutoSquareOffEnabled}");
        if (old.AutoSquareOffTime     != next.AutoSquareOffTime)     changes.Add($"AutoSquareOffTime {old.AutoSquareOffTime}→{next.AutoSquareOffTime}");
        if (old.WatchedProducts       != next.WatchedProducts)       changes.Add($"WatchedProducts {old.WatchedProducts}→{next.WatchedProducts}");
        return changes.Count > 0 ? string.Join(", ", changes) : "unknown";
    }
}
