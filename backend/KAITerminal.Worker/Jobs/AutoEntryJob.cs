using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Options;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Infrastructure.Services;
using KAITerminal.MarketData.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker.Jobs;

/// <summary>
/// Scheduled option-selling automation. Runs every 30 seconds during trading hours.
/// Reads AutoEntryConfigs from DB, checks eligibility (day, time window, expiry exclusion,
/// already-entered-today guard), then selects a strike and places a SELL MIS order.
/// The already-entered-today state is persisted in AutoEntryLogs so a server restart
/// does not re-enter on the same day.
/// </summary>
internal sealed class AutoEntryJob : BackgroundService
{
    private static readonly TimeZoneInfo Ist         = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
    private static readonly TimeSpan     TradingStart = new(9,  15, 0);
    private static readonly TimeSpan     TradingEnd   = new(15, 30, 0);
    private static readonly TimeSpan     CheckInterval = TimeSpan.FromSeconds(30);

    private readonly IOptionContractProvider _contractProvider;
    private readonly IOptionChainProvider    _chainProvider;
    private readonly IMarketQuoteService     _quoteService;
    private readonly IBrokerClientFactory    _brokerFactory;
    private readonly IServiceScopeFactory    _scopeFactory;
    private readonly ILogger<AutoEntryJob>   _logger;

    public AutoEntryJob(
        IEnumerable<IOptionContractProvider> contractProviders,
        IOptionChainProvider                 chainProvider,
        IMarketQuoteService                  quoteService,
        IBrokerClientFactory                 brokerFactory,
        IServiceScopeFactory                 scopeFactory,
        ILogger<AutoEntryJob>                logger)
    {
        _contractProvider = contractProviders.First(p => p.BrokerType == BrokerNames.Upstox);
        _chainProvider    = chainProvider;
        _quoteService     = quoteService;
        _brokerFactory    = brokerFactory;
        _scopeFactory     = scopeFactory;
        _logger           = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(CheckInterval);
        while (await timer.WaitForNextTickAsync(ct))
        {
            var nowIst = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Ist);
            if (nowIst.TimeOfDay < TradingStart || nowIst.TimeOfDay >= TradingEnd)
                continue;

            await RunCheckAsync(nowIst, ct);
        }
    }

    private async Task RunCheckAsync(DateTimeOffset nowIst, CancellationToken ct)
    {
        List<AutoEntryConfig> configs;
        using (var scope = _scopeFactory.CreateScope())
        {
            var svc = scope.ServiceProvider.GetRequiredService<IAutoEntryConfigService>();
            configs = (await svc.GetAllEnabledAsync(ct)).ToList();
        }

        if (configs.Count == 0) return;

        // Fetch contracts once — shared across all configs for efficiency.
        IReadOnlyList<IndexContracts> allContracts;
        try
        {
            allContracts = await _contractProvider.GetContractsAsync("", null, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AutoEntry — failed to fetch contract data, skipping tick");
            return;
        }

        foreach (var config in configs)
        {
            try
            {
                await EvaluateConfigAsync(config, nowIst, allContracts, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "AutoEntry — unhandled error for {User} ({Broker}), skipping",
                    config.Username, config.BrokerType);
            }
        }
    }

    private async Task EvaluateConfigAsync(
        AutoEntryConfig config, DateTimeOffset nowIst,
        IReadOnlyList<IndexContracts> allContracts, CancellationToken ct)
    {
        var todayIst    = DateOnly.FromDateTime(nowIst.DateTime);
        var todayIstStr = todayIst.ToString("yyyy-MM-dd");

        // 1. Day check — skipped when OnlyExpiryDay is set (expiry check happens later)
        if (!config.OnlyExpiryDay && !IsTradingDay(config.TradingDays, nowIst.DayOfWeek))
        {
            _logger.LogDebug("AutoEntry skipped — {Day} not in trading days [{User} / {Broker} / {Strategy}]",
                nowIst.DayOfWeek, config.Username, config.BrokerType, config.Name);
            return;
        }

        // 2. Time window check
        if (!TimeOnly.TryParse(config.EntryAfterTime,   out var entryAfter)   ||
            !TimeOnly.TryParse(config.NoEntryAfterTime, out var noEntryAfter))
        {
            _logger.LogWarning("AutoEntry — invalid time config for {User} ({Broker}), skipping",
                config.Username, config.BrokerType);
            return;
        }

        var nowTime = TimeOnly.FromTimeSpan(nowIst.TimeOfDay);
        if (nowTime < entryAfter || nowTime >= noEntryAfter)
        {
            _logger.LogDebug("AutoEntry skipped — time {Now} outside window {After}–{Before} [{User} / {Broker} / {Strategy}]",
                nowTime, entryAfter, noEntryAfter, config.Username, config.BrokerType, config.Name);
            return;
        }

        // 3. Already entered today (safe-restart guard)
        using var scope = _scopeFactory.CreateScope();
        var db  = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var svc = scope.ServiceProvider.GetRequiredService<IAutoEntryConfigService>();
        var alreadyEntered = await svc.HasEnteredTodayAsync(config.Id, todayIstStr, ct);
        if (alreadyEntered)
        {
            _logger.LogDebug("AutoEntry skipped — already entered today [{User} / {Broker} / {Strategy}]",
                config.Username, config.BrokerType, config.Name);
            return;
        }

        // 4. Broker credentials
        var brokerType = config.BrokerType.ToLower();
        var cred = await db.BrokerCredentials.FirstOrDefaultAsync(
            c => c.Username == config.Username
              && c.BrokerName.ToLower() == brokerType
              && !string.IsNullOrEmpty(c.AccessToken), ct);
        if (cred is null)
        {
            _logger.LogWarning("AutoEntry — no valid credentials for {User} ({Broker}), skipping",
                config.Username, config.BrokerType);
            return;
        }

        // 5. Resolve expiry
        var indexContracts = allContracts.FirstOrDefault(ic =>
            ic.Index.Equals(config.Instrument, StringComparison.OrdinalIgnoreCase));
        if (indexContracts is null)
        {
            _logger.LogWarning("AutoEntry — no contracts found for instrument {Instrument}", config.Instrument);
            return;
        }

        var upcomingExpiries = indexContracts.Contracts
            .Select(c => c.Expiry)
            .Distinct()
            .Where(e => DateOnly.TryParse(e, out var d) && d >= todayIst)
            .OrderBy(e => e)
            .ToList();

        if (upcomingExpiries.Count <= config.ExpiryOffset)
        {
            _logger.LogWarning("AutoEntry — not enough expiries for {Instrument} at offset {Offset}",
                config.Instrument, config.ExpiryOffset);
            return;
        }

        var expiry      = upcomingExpiries[config.ExpiryOffset];
        var expiryDate  = DateOnly.Parse(expiry);

        // 6. Expiry day gate
        if (config.OnlyExpiryDay && expiryDate != todayIst)
        {
            _logger.LogInformation("AutoEntry — OnlyExpiryDay set but today is not expiry, skipping [{User} / {Broker}]",
                config.Username, config.BrokerType);
            return;
        }
        if (!config.OnlyExpiryDay && config.ExcludeExpiryDay && expiryDate == todayIst)
        {
            _logger.LogInformation("AutoEntry — {Instrument} expiry today, skipping [{User} / {Broker}]",
                config.Instrument, config.Username, config.BrokerType);
            return;
        }

        // 7. Spot price
        var underlyingKey = WorkerIndexKeys.UnderlyingFeedKeys.GetValueOrDefault(
            config.Instrument.ToUpperInvariant());
        if (underlyingKey is null)
        {
            _logger.LogWarning("AutoEntry — unknown instrument {Instrument}", config.Instrument);
            return;
        }

        decimal spot;
        try
        {
            var quotes = await _quoteService.GetMarketQuotesAsync([underlyingKey], ct);
            if (!quotes.TryGetValue(underlyingKey, out var quote) || quote.LastPrice <= 0)
            {
                _logger.LogWarning("AutoEntry — could not get spot price for {Instrument}", config.Instrument);
                return;
            }
            spot = quote.LastPrice;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AutoEntry — spot price fetch failed for {Instrument}", config.Instrument);
            return;
        }

        // 8. Strike selection and order placement
        var broker = _brokerFactory.Create(config.BrokerType, cred.AccessToken, cred.ApiKey);

        var optionTypes = config.OptionType == "CE+PE"
            ? new[] { "CE", "PE" }
            : new[] { config.OptionType };

        bool anyPlaced = false;
        foreach (var optionType in optionTypes)
        {
            var (token, exchange) = await ResolveStrikeTokenAsync(
                config, optionType, expiry, spot, indexContracts.Contracts, ct);

            if (token is null)
            {
                _logger.LogWarning(
                    "AutoEntry — could not resolve {OptionType} strike for {Instrument} [{User} / {Broker}]",
                    optionType, config.Instrument, config.Username, config.BrokerType);
                continue;
            }

            var lotSize = indexContracts.Contracts
                .FirstOrDefault(c => c.InstrumentType.Equals(optionType, StringComparison.OrdinalIgnoreCase)
                    && c.Expiry == expiry)?.LotSize ?? 1;

            var qty = config.Lots * (int)lotSize;
            var order = new BrokerOrderRequest(token, qty, "SELL", "I", "MARKET", Exchange: exchange);

            _logger.LogInformation(
                "AutoEntry placing SELL {OptionType} {Instrument} expiry={Expiry} token={Token} qty={Qty} lots={Lots} lotSize={LotSize} mode={Mode} [{User} / {Broker}]",
                optionType, config.Instrument, expiry, token, qty, config.Lots, lotSize, config.StrikeMode, config.Username, config.BrokerType);

            try
            {
                await broker.PlaceOrderAsync(order, ct);
                anyPlaced = true;
                _logger.LogInformation(
                    "AutoEntry order placed — {OptionType} {Instrument} qty={Qty} [{User} / {Broker}]",
                    optionType, config.Instrument, qty, config.Username, config.BrokerType);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "AutoEntry — order placement failed for {OptionType} {Instrument} [{User} / {Broker}]",
                    optionType, config.Instrument, config.Username, config.BrokerType);
            }
        }

        // 9. Log entry to DB (once per day, regardless of CE/PE split)
        if (anyPlaced)
        {
            await svc.LogEntryAsync(config.Id, config.Instrument, todayIstStr, DateTime.UtcNow, ct);
            _logger.LogInformation(
                "AutoEntry logged for {User} ({Broker}) on {Date}",
                config.Username, config.BrokerType, todayIstStr);
        }
    }

    private async Task<(string? token, string? exchange)> ResolveStrikeTokenAsync(
        AutoEntryConfig config, string optionType, string expiry, decimal spot,
        IReadOnlyList<ContractEntry> contracts, CancellationToken ct)
    {
        var filtered = contracts
            .Where(c => c.Expiry == expiry
                && c.InstrumentType.Equals(optionType, StringComparison.OrdinalIgnoreCase))
            .OrderBy(c => c.StrikePrice)
            .ToList();

        if (filtered.Count == 0) return (null, null);

        return config.StrikeMode switch
        {
            "ATM"     => SelectAtm(filtered, spot, config.BrokerType, config.Instrument),
            "OTM"     => SelectOtm(filtered, spot, optionType, config.StrikeParam, config.BrokerType, config.Instrument),
            "Delta"   => await SelectByDeltaAsync(config, optionType, expiry, spot, contracts, (double)config.StrikeParam, ct),
            "Premium" => await SelectByPremiumAsync(config, optionType, expiry, contracts, config.StrikeParam, ct),
            _         => SelectAtm(filtered, spot, config.BrokerType, config.Instrument),
        };
    }

    private static (string? token, string? exchange) SelectAtm(
        List<ContractEntry> filtered, decimal spot,
        string brokerType, string instrument)
    {
        var entry = filtered.MinBy(c => Math.Abs(c.StrikePrice - spot));
        if (entry is null) return (null, null);
        return ExtractToken(entry, brokerType, instrument);
    }

    private static (string? token, string? exchange) SelectOtm(
        List<ContractEntry> filtered, decimal spot, string optionType,
        decimal strikeParam, string brokerType, string instrument)
    {
        // ATM index
        var atmIdx = filtered
            .Select((c, i) => (i, diff: Math.Abs(c.StrikePrice - spot)))
            .MinBy(t => t.diff).i;

        // OTM direction: CE sellers want higher strikes (+), PE sellers want lower strikes (-)
        int steps  = (int)strikeParam;
        var offset = optionType.Equals("CE", StringComparison.OrdinalIgnoreCase) ? steps : -steps;
        var idx    = Math.Clamp(atmIdx + offset, 0, filtered.Count - 1);

        return ExtractToken(filtered[idx], brokerType, instrument);
    }

    private async Task<(string? token, string? exchange)> SelectByDeltaAsync(
        AutoEntryConfig config, string optionType, string expiry, decimal spot,
        IReadOnlyList<ContractEntry> contracts, double targetDelta, CancellationToken ct)
    {
        var underlyingKey = WorkerIndexKeys.UnderlyingFeedKeys[config.Instrument.ToUpperInvariant()];
        IReadOnlyList<OptionChainEntry> chain;
        try
        {
            chain = await _chainProvider.GetChainAsync(underlyingKey, expiry, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AutoEntry Delta — chain fetch failed for {Instrument}", config.Instrument);
            return (null, null);
        }

        var isCe   = optionType.Equals("CE", StringComparison.OrdinalIgnoreCase);
        var best   = chain
            .Select(e => (entry: e, side: isCe ? e.CallOptions : e.PutOptions))
            .Where(x => x.side?.OptionGreeks is not null && !string.IsNullOrEmpty(x.side.InstrumentKey))
            .MinBy(x => Math.Abs(Math.Abs((double)x.side!.OptionGreeks!.Delta) - targetDelta));

        if (best == default) return (null, null);
        _logger.LogInformation(
            "AutoEntry Delta — selected {OptionType} strike={Strike} delta={Delta:F3} (target={Target}) [{User} / {Broker}]",
            optionType, best.entry.StrikePrice, best.side!.OptionGreeks!.Delta, targetDelta, config.Username, config.BrokerType);
        return ResolveUpstoxKeyToToken(best.side!.InstrumentKey, config.BrokerType, contracts, config.Instrument);
    }

    private async Task<(string? token, string? exchange)> SelectByPremiumAsync(
        AutoEntryConfig config, string optionType, string expiry,
        IReadOnlyList<ContractEntry> contracts, decimal targetPremium, CancellationToken ct)
    {
        var underlyingKey = WorkerIndexKeys.UnderlyingFeedKeys[config.Instrument.ToUpperInvariant()];
        IReadOnlyList<OptionChainEntry> chain;
        try
        {
            chain = await _chainProvider.GetChainAsync(underlyingKey, expiry, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AutoEntry Premium — chain fetch failed for {Instrument}", config.Instrument);
            return (null, null);
        }

        var isCe = optionType.Equals("CE", StringComparison.OrdinalIgnoreCase);
        var best = chain
            .Select(e => (entry: e, side: isCe ? e.CallOptions : e.PutOptions))
            .Where(x => x.side?.MarketData is not null && !string.IsNullOrEmpty(x.side.InstrumentKey))
            .MinBy(x => Math.Abs(x.side!.MarketData!.Ltp - targetPremium));

        if (best == default) return (null, null);
        _logger.LogInformation(
            "AutoEntry Premium — selected {OptionType} strike={Strike} ltp=₹{Ltp} (target=₹{Target}) [{User} / {Broker}]",
            optionType, best.entry.StrikePrice, best.side!.MarketData!.Ltp, targetPremium, config.Username, config.BrokerType);
        return ResolveUpstoxKeyToToken(best.side!.InstrumentKey, config.BrokerType, contracts, config.Instrument);
    }

    private static (string? token, string? exchange) ExtractToken(
        ContractEntry entry, string brokerType, string instrument)
    {
        if (brokerType.Equals(BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase))
            return (entry.UpstoxToken, null);

        // Zerodha: exchange is inferred by ZerodhaOrderService from the trading symbol,
        // but we pass it explicitly to be safe.
        var exchange = instrument is "SENSEX" or "BANKEX" ? "BFO" : "NFO";
        return (string.IsNullOrEmpty(entry.ZerodhaToken) ? null : entry.ZerodhaToken, exchange);
    }

    private static (string? token, string? exchange) ResolveUpstoxKeyToToken(
        string upstoxKey, string brokerType,
        IReadOnlyList<ContractEntry> contracts, string instrument)
    {
        if (brokerType.Equals(BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase))
            return (upstoxKey, null);

        var exchangeToken = upstoxKey.Contains('|') ? upstoxKey.Split('|')[1] : upstoxKey;
        var match = contracts.FirstOrDefault(c =>
            c.UpstoxToken.Contains('|') &&
            c.UpstoxToken.Split('|')[1].Equals(exchangeToken, StringComparison.OrdinalIgnoreCase));

        if (match is null || string.IsNullOrEmpty(match.ZerodhaToken))
            return (null, null);

        var exchange = instrument is "SENSEX" or "BANKEX" ? "BFO" : "NFO";
        return (match.ZerodhaToken, exchange);
    }

    private static bool IsTradingDay(string tradingDays, DayOfWeek dayOfWeek)
    {
        var dayAbbr = dayOfWeek switch
        {
            DayOfWeek.Monday    => "Mon",
            DayOfWeek.Tuesday   => "Tue",
            DayOfWeek.Wednesday => "Wed",
            DayOfWeek.Thursday  => "Thu",
            DayOfWeek.Friday    => "Fri",
            _                   => "",
        };
        if (string.IsNullOrEmpty(dayAbbr)) return false;
        return tradingDays.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Any(d => d.Trim().Equals(dayAbbr, StringComparison.OrdinalIgnoreCase));
    }
}
