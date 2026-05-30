using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Notifications;
using KAITerminal.Contracts.Streaming;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using Microsoft.Extensions.Logging;

namespace KAITerminal.RiskEngine.Workers;

/// <summary>
/// Fetches positions for a user, updates the position cache, and ensures the
/// shared LTP feed is subscribed to all currently-open instruments. Reports
/// session-startup state via the notifier.
/// </summary>
public sealed class PositionPoller
{
    private readonly IPositionCache              _cache;
    private readonly ITokenMapper                _tokenMapper;
    private readonly ISharedMarketDataService    _sharedMarketData;
    private readonly IRiskEventNotifier          _notifier;
    private readonly ILogger<PositionPoller>     _logger;

    public PositionPoller(
        IPositionCache             cache,
        ITokenMapper               tokenMapper,
        ISharedMarketDataService   sharedMarketData,
        IRiskEventNotifier         notifier,
        ILogger<PositionPoller>    logger)
    {
        _cache            = cache;
        _tokenMapper      = tokenMapper;
        _sharedMarketData = sharedMarketData;
        _notifier         = notifier;
        _logger           = logger;
    }

    public async Task PollAsync(
        string         stateKey,
        UserConfig     user,
        IBrokerClient  broker,
        bool           isStartup,
        CancellationToken ct)
    {
        _logger.LogDebug("[POLL ] Positions — {UserId} ({Broker})", user.UserId, user.BrokerType);

        var rawPositions = await broker.GetAllPositionsAsync(ct);
        var positions    = ApplyWatchedProductsFilter(rawPositions, user.WatchedProducts);

        LogPositions(user, positions.Count, rawPositions.Count, isStartup);
        _cache.UpdatePositions(stateKey, positions);

        await SubscribeOpenInstrumentsAsync(stateKey, user, isStartup, ct);

        if (isStartup) await NotifySessionStartedAsync(stateKey, user, rawPositions, ct);
    }

    private static IReadOnlyList<BrokerPosition> ApplyWatchedProductsFilter(
        IReadOnlyList<BrokerPosition> raw, string watchedProducts) =>
        watchedProducts == "All"
            ? raw
            : raw.Where(p => ProductTypeFilter.Matches(p.Product, watchedProducts))
                 .ToList().AsReadOnly();

    private void LogPositions(UserConfig user, int watched, int total, bool isStartup)
    {
        if (isStartup)
        {
            if (user.WatchedProducts == "All")
                _logger.LogInformation(
                    "[POS  ] Loaded — {UserId} ({Broker})  |  {Count} position(s)  [all products]",
                    user.UserId, user.BrokerType, watched);
            else
                _logger.LogInformation(
                    "[POS  ] Loaded — {UserId} ({Broker})  |  {Watched}/{Total} position(s)  [{Filter} only — {Excluded} excluded]",
                    user.UserId, user.BrokerType, watched, total, user.WatchedProducts, total - watched);
        }
        else
        {
            _logger.LogDebug("[POLL ] Positions — {UserId} ({Broker})  |  {Watched}/{Total}  [{Filter}]",
                user.UserId, user.BrokerType, watched, total, user.WatchedProducts);
        }
    }

    private async Task SubscribeOpenInstrumentsAsync(
        string stateKey, UserConfig user, bool isStartup, CancellationToken ct)
    {
        var openTokens = _cache.GetOpenInstrumentTokens(stateKey);
        if (openTokens.Count == 0) return;

        await _tokenMapper.EnsureReadyAsync(user.BrokerType, ct);
        var feedTokens = _tokenMapper.ToFeedTokens(user.BrokerType, openTokens);

        if (isStartup)
            _logger.LogInformation("[FEED ] Subscribing {Count} instrument(s) — {UserId} ({Broker})",
                feedTokens.Count, user.UserId, user.BrokerType);

        await _sharedMarketData.SubscribeAsync(feedTokens, FeedMode.Ltpc, ct);
    }

    private async Task NotifySessionStartedAsync(
        string stateKey, UserConfig user,
        IReadOnlyList<BrokerPosition> rawPositions, CancellationToken ct)
    {
        var openTokens = _cache.GetOpenInstrumentTokens(stateKey);
        var watchLabel = WatchLabel(user.WatchedProducts);
        var totalOpen  = rawPositions.Count(p => p.IsOpen);

        if (user.WatchedProducts == "All" || totalOpen == openTokens.Count)
            _logger.LogInformation("[FEED ] Live — {UserId} ({Broker})  |  {Count} open instrument(s)  [{Watch}]",
                user.UserId, user.BrokerType, openTokens.Count, watchLabel);
        else
            _logger.LogWarning(
                "[FEED ] Live — {UserId} ({Broker})  |  {Watched}/{Total} open instrument(s)  [{Watch} filter — {Excluded} excluded]",
                user.UserId, user.BrokerType, openTokens.Count, totalOpen, watchLabel, totalOpen - openTokens.Count);

        if (openTokens.Count == 0) return;

        await _notifier.NotifyAsync(new RiskNotification(
            user.UserId, user.BrokerType, RiskNotificationType.SessionStarted,
            _cache.GetMtm(stateKey),
            Target:            user.MtmTarget,
            Sl:                user.MtmSl,
            OpenPositionCount: openTokens.Count,
            Timestamp:         DateTimeOffset.UtcNow), ct);
    }

    private static string WatchLabel(string watchedProducts) => watchedProducts switch
    {
        "Intraday" => "Intraday",
        "Delivery" => "Delivery",
        _          => "Intraday + Delivery",
    };
}
