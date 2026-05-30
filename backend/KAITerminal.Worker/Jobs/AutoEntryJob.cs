using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Options;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Infrastructure.Services;
using KAITerminal.MarketData.Services;
using KAITerminal.Util;
using KAITerminal.Worker.Jobs.AutoEntry;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker.Jobs;

/// <summary>
/// Scheduled option-selling automation. Runs every 30 seconds during trading hours,
/// loads enabled auto-entry configs, and delegates eligibility / strike selection /
/// order placement to focused collaborators.
/// </summary>
internal sealed class AutoEntryJob : BackgroundService
{
    private static readonly TimeZoneInfo Ist           = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
    private static readonly TimeSpan     TradingStart  = new(9,  15, 0);
    private static readonly TimeSpan     TradingEnd    = new(15, 30, 0);
    private static readonly TimeSpan     CheckInterval = TimeSpan.FromSeconds(30);

    private readonly IOptionContractProvider  _upstoxContracts;
    private readonly IOptionContractProvider? _zerodhaContracts;
    private readonly IMarketQuoteService      _quoteService;
    private readonly IBrokerClientFactory     _brokerFactory;
    private readonly StrikeSelectorRegistry   _selectors;
    private readonly AutoEntryOrderPlacer     _orderPlacer;
    private readonly IServiceScopeFactory     _scopeFactory;
    private readonly ILogger<AutoEntryJob>    _logger;

    public AutoEntryJob(
        IEnumerable<IOptionContractProvider> contractProviders,
        IMarketQuoteService                  quoteService,
        IBrokerClientFactory                 brokerFactory,
        StrikeSelectorRegistry               selectors,
        AutoEntryOrderPlacer                 orderPlacer,
        IServiceScopeFactory                 scopeFactory,
        ILogger<AutoEntryJob>                logger)
    {
        var providers = contractProviders.ToList();
        _upstoxContracts  = providers.First(p => p.BrokerType == BrokerNames.Upstox);
        _zerodhaContracts = providers.FirstOrDefault(p => p.BrokerType == BrokerNames.Zerodha);
        _quoteService     = quoteService;
        _brokerFactory    = brokerFactory;
        _selectors        = selectors;
        _orderPlacer      = orderPlacer;
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
        var configs = await LoadEnabledConfigsAsync(ct);
        if (configs.Count == 0) return;

        var allContracts = await FetchMergedContractsAsync(ct);
        if (allContracts is null) return;

        foreach (var config in configs)
        {
            try
            {
                await EvaluateConfigAsync(config, nowIst, allContracts, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "[ERROR] AutoEntry unhandled error — {User} ({Broker}) — skipping",
                    config.Username, config.BrokerType);
            }
        }
    }

    private async Task<List<AutoEntryConfig>> LoadEnabledConfigsAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IAutoEntryConfigService>();
        return (await svc.GetAllEnabledAsync(ct)).ToList();
    }

    /// <summary>
    /// Merges Upstox + Zerodha contracts by exchange_token so each entry has both broker tokens.
    /// Returns null on fetch failure so the tick is skipped.
    /// </summary>
    private async Task<IReadOnlyList<IndexContracts>?> FetchMergedContractsAsync(CancellationToken ct)
    {
        try
        {
            var upstox = await _upstoxContracts.GetContractsAsync("", null, ct);
            if (_zerodhaContracts is null) return upstox;

            var zerodha = await _zerodhaContracts.GetContractsAsync("", null, ct);
            var zerodhaByExchangeToken = zerodha
                .SelectMany(ic => ic.Contracts)
                .Where(c => !string.IsNullOrEmpty(c.ZerodhaToken) && !string.IsNullOrEmpty(c.ExchangeToken))
                .ToDictionary(c => c.ExchangeToken, c => c.ZerodhaToken, StringComparer.OrdinalIgnoreCase);

            return upstox
                .Select(ic => new IndexContracts(
                    ic.Index,
                    ic.Contracts
                        .Select(c => c with { ZerodhaToken = zerodhaByExchangeToken.GetValueOrDefault(c.ExchangeToken, "") })
                        .ToList()))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ENTRY] Contract fetch failed — skipping tick");
            return null;
        }
    }

    private async Task EvaluateConfigAsync(
        AutoEntryConfig                config,
        DateTimeOffset                 nowIst,
        IReadOnlyList<IndexContracts>  allContracts,
        CancellationToken              ct)
    {
        var todayIst    = DateOnly.FromDateTime(nowIst.DateTime);
        var todayIstStr = todayIst.ToString("yyyy-MM-dd");
        var ctx         = $"[{config.Username} / {config.BrokerType} / {config.Name}]";

        var scheduleSkip = AutoEntryEligibility.CheckSchedule(config, nowIst);
        if (scheduleSkip is not null)
        {
            LogEligibilitySkip(scheduleSkip, ctx);
            return;
        }

        using var scope = _scopeFactory.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IAutoEntryConfigService>();
        if (await svc.HasEnteredTodayAsync(config.Id, todayIstStr, ct))
        {
            _logger.LogDebug("[SKIP ] Already entered today  {Ctx}", ctx);
            return;
        }

        var cred = await ResolveCredentialAsync(scope, config, ct);
        if (cred is null) return;

        var indexContracts = allContracts.FirstOrDefault(ic =>
            ic.Index.Equals(config.Instrument, StringComparison.OrdinalIgnoreCase));
        if (indexContracts is null)
        {
            _logger.LogWarning("[ENTRY] No contracts for {Instrument}", config.Instrument);
            return;
        }

        var expiry = ResolveExpiry(indexContracts, config, todayIst);
        if (expiry is null) return;

        var expiryDate     = DateOnly.Parse(expiry);
        var expiryDaySkip  = AutoEntryEligibility.CheckExpiryDay(
            config.ExpiryDayPolicy(), expiryDate, todayIst, config.Instrument);
        if (expiryDaySkip is not null)
        {
            LogEligibilitySkip(expiryDaySkip, ctx);
            return;
        }

        var spot = await ResolveSpotAsync(config, ct);
        if (spot is null) return;

        var broker = _brokerFactory.Create(config.BrokerType, cred.AccessToken, cred.ApiKey, config.Username);
        var anyPlaced = await PlaceAllOptionLegsAsync(
            broker, config, expiry, spot.Value, indexContracts.Contracts, ct);

        if (anyPlaced)
        {
            await svc.LogEntryAsync(config.Id, config.Instrument, todayIstStr, DateTime.UtcNow, ct);
            _logger.LogInformation(
                "[ENTRY] Logged — {User} ({Broker})  |  {Date}",
                config.Username, config.BrokerType, todayIstStr);
        }
    }

    private async Task<BrokerCredential?> ResolveCredentialAsync(
        IServiceScope scope, AutoEntryConfig config, CancellationToken ct)
    {
        var db         = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var brokerType = config.BrokerType.ToLower();
        var cred = await db.BrokerCredentials.FirstOrDefaultAsync(
            c => c.Username == config.Username && c.BrokerName.ToLower() == brokerType, ct);

        if (cred is null)
        {
            _logger.LogWarning("[ENTRY] Token {Reason} — {User} ({Broker}) — skipping",
                TokenValidationResult.Missing, config.Username, config.BrokerType);
            return null;
        }

        var tokenResult = BrokerTokenHelper.Validate(cred.AccessToken, cred.UpdatedAt, cred.BrokerName);
        if (tokenResult != TokenValidationResult.Valid)
        {
            _logger.LogWarning("[ENTRY] Token {Reason} — {User} ({Broker}) — skipping",
                tokenResult, config.Username, config.BrokerType);
            return null;
        }

        return cred;
    }

    private string? ResolveExpiry(IndexContracts indexContracts, AutoEntryConfig config, DateOnly today)
    {
        var upcoming = indexContracts.Contracts
            .Select(c => c.Expiry)
            .Distinct()
            .Where(e => DateOnly.TryParse(e, out var d) && d >= today)
            .OrderBy(e => e)
            .ToList();

        if (upcoming.Count <= config.ExpiryOffset)
        {
            _logger.LogWarning("[ENTRY] Not enough expiries — {Instrument} offset={Offset}",
                config.Instrument, config.ExpiryOffset);
            return null;
        }

        return upcoming[config.ExpiryOffset];
    }

    private async Task<decimal?> ResolveSpotAsync(AutoEntryConfig config, CancellationToken ct)
    {
        var underlyingKey = WorkerIndexKeys.UnderlyingFeedKeys.GetValueOrDefault(
            config.Instrument.ToUpperInvariant());
        if (underlyingKey is null)
        {
            _logger.LogWarning("[ENTRY] Unknown instrument {Instrument}", config.Instrument);
            return null;
        }

        try
        {
            var quotes   = await _quoteService.GetMarketQuotesAsync([underlyingKey], ct);
            // Upstox REST market-quote API returns ':' in keys (e.g. "NSE_INDEX:Nifty 50")
            // while UnderlyingFeedKeys uses '|' — convert for lookup only.
            var quoteKey = underlyingKey.Replace('|', ':');
            if (!quotes.TryGetValue(quoteKey, out var quote))
            {
                _logger.LogWarning("[ENTRY] Quote key {Key} not found  |  {Instrument}", quoteKey, config.Instrument);
                return null;
            }
            if (quote.LastPrice <= 0)
            {
                _logger.LogWarning("[ENTRY] Spot price {Price} invalid (≤ 0)  |  {Instrument}",
                    quote.LastPrice, config.Instrument);
                return null;
            }
            return quote.LastPrice;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ERROR] Spot price fetch failed — {Instrument}", config.Instrument);
            return null;
        }
    }

    private async Task<bool> PlaceAllOptionLegsAsync(
        IBrokerClient                 broker,
        AutoEntryConfig               config,
        string                        expiry,
        decimal                       spot,
        IReadOnlyList<ContractEntry>  contracts,
        CancellationToken             ct)
    {
        var optionTypes = config.OptionType == "CE+PE"
            ? new[] { "CE", "PE" }
            : new[] { config.OptionType };

        var selector = _selectors.For(config.StrikeMode);
        bool anyPlaced = false;

        foreach (var optionType in optionTypes)
        {
            var resolution = await selector.SelectAsync(
                new StrikeSelectionContext(config, optionType, expiry, spot, contracts), ct);

            if (resolution is null)
            {
                _logger.LogWarning(
                    "[ENTRY] Cannot resolve {OptionType} strike  |  {Instrument}  [{User} / {Broker}]",
                    optionType, config.Instrument, config.Username, config.BrokerType);
                continue;
            }

            if (await _orderPlacer.PlaceAsync(broker, config, optionType, expiry, resolution, contracts, ct))
                anyPlaced = true;
        }

        return anyPlaced;
    }

    private void LogEligibilitySkip(EligibilityResult result, string ctx)
    {
        if (result.Severity == EligibilitySeverity.InvalidConfigWarning)
            _logger.LogWarning("[ENTRY] {Reason}  {Ctx}", result.Reason, ctx);
        else
            _logger.LogDebug("[SKIP ] {Reason}  {Ctx}", result.Reason, ctx);
    }
}
