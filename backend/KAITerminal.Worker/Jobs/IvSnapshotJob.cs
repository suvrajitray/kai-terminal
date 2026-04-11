using KAITerminal.Contracts;
using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Options;
using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker;

/// <summary>
/// Captures a daily ATM IV snapshot for all indices at market close (15:30 IST).
/// Runs every 30 minutes. If today's snapshot is missing and it's already ≥ 15:30 IST,
/// takes it immediately (handles restarts after close).
///
/// Expiry dates are resolved from actual contract data (not hardcoded day-of-week),
/// so holidays and monthly-only indices are handled automatically.
/// </summary>
internal sealed class IvSnapshotJob : BackgroundService
{
    private static readonly TimeZoneInfo Ist = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");

    // Underlying name → Upstox index key for GetChainAsync
    private static IReadOnlyDictionary<string, string> UnderlyingKeys => WorkerIndexKeys.UnderlyingFeedKeys;

    private static readonly TimeSpan SnapshotTime  = new(15, 30, 0);
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(30);

    private readonly IOptionContractProvider _contractProvider;
    private readonly IOptionChainProvider    _chainProvider;
    private readonly IServiceScopeFactory    _scopeFactory;
    private readonly ILogger<IvSnapshotJob>  _logger;

    private DateOnly _lastSnapshotDate = DateOnly.MinValue;

    public IvSnapshotJob(
        IEnumerable<IOptionContractProvider> contractProviders,
        IOptionChainProvider                 chainProvider,
        IServiceScopeFactory                 scopeFactory,
        ILogger<IvSnapshotJob>               logger)
    {
        // UpstoxOptionContractProvider uses the admin analytics token — no user token needed
        _contractProvider = contractProviders.First(p => p.BrokerType == BrokerNames.Upstox);
        _chainProvider    = chainProvider;
        _scopeFactory     = scopeFactory;
        _logger           = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Catch-up: if it's already past 15:30 and today has no snapshot, run now.
        await TrySnapshotAsync(ct);

        using var timer = new PeriodicTimer(CheckInterval);
        while (await timer.WaitForNextTickAsync(ct))
        {
            await TrySnapshotAsync(ct);
        }
    }

    private async Task TrySnapshotAsync(CancellationToken ct)
    {
        var nowIst   = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Ist);
        var todayIst = DateOnly.FromDateTime(nowIst.DateTime);

        if (nowIst.TimeOfDay < SnapshotTime) return;
        if (_lastSnapshotDate >= todayIst)   return;

        _lastSnapshotDate = todayIst; // optimistic — prevents duplicate runs this day

        _logger.LogInformation("IV snapshot starting for {Date}", todayIst);

        // Fetch actual contract data to resolve real expiry dates per underlying.
        // UpstoxOptionContractProvider ignores the token params and uses analytics token.
        IReadOnlyList<IndexContracts> allContracts;
        try
        {
            allContracts = await _contractProvider.GetContractsAsync("", null, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "IV snapshot aborted — could not fetch contract data");
            _lastSnapshotDate = DateOnly.MinValue; // allow retry next cycle
            return;
        }

        // Build map: underlying name → nearest expiry strictly after today
        // (today is skipped to avoid anomalous 0-DTE IV on expiry day)
        var expiryByUnderlying = allContracts.ToDictionary(
            ic => ic.Index.ToUpperInvariant(),
            ic => ic.Contracts
                .Select(c => c.Expiry)
                .Distinct()
                .Where(e => DateOnly.TryParse(e, out var d) && d > todayIst)
                .Order()
                .FirstOrDefault(),
            StringComparer.OrdinalIgnoreCase);

        foreach (var (name, upstoxKey) in UnderlyingKeys)
        {
            if (!expiryByUnderlying.TryGetValue(name, out var expiry) || expiry is null)
            {
                _logger.LogWarning("IV snapshot skipped for {Underlying} — no upcoming expiry found", name);
                continue;
            }

            try
            {
                await SnapshotOneAsync(name, upstoxKey, expiry, todayIst, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "IV snapshot failed for {Underlying}", name);
            }
        }
    }

    private async Task SnapshotOneAsync(
        string name, string underlyingKey, string expiry,
        DateOnly date, CancellationToken ct)
    {
        var chain = await _chainProvider.GetChainAsync(underlyingKey, expiry, ct);
        if (chain.Count == 0) return;

        var spot = chain[0].UnderlyingSpotPrice;
        if (spot <= 0) return;

        var atm = chain.MinBy(e => Math.Abs(e.StrikePrice - spot))!;

        var callIv = atm.CallOptions?.OptionGreeks?.Iv ?? 0;
        var putIv  = atm.PutOptions?.OptionGreeks?.Iv  ?? 0;
        var atmIv  = callIv > 0 && putIv > 0 ? (callIv + putIv) / 2
                   : callIv > 0 ? callIv
                   : putIv;

        if (atmIv <= 0)
        {
            _logger.LogWarning("IV snapshot skipped for {Underlying} — ATM IV is 0 (market closed?)", name);
            return;
        }

        var snapshot = new IvSnapshot
        {
            Date       = date,
            Underlying = name.ToUpperInvariant(),
            Expiry     = expiry,
            AtmStrike  = atm.StrikePrice,
            AtmIv      = atmIv,
            AtmCallLtp = atm.CallOptions?.MarketData?.Ltp ?? 0,
            AtmPutLtp  = atm.PutOptions?.MarketData?.Ltp  ?? 0,
            SpotPrice  = spot,
            CreatedAt  = DateTime.UtcNow,
        };

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var exists = await db.IvSnapshots.AnyAsync(
            s => s.Date == date && s.Underlying == snapshot.Underlying && s.Expiry == expiry, ct);

        if (exists)
        {
            _logger.LogDebug("IV snapshot already stored for {Underlying} {Date}", name, date);
            return;
        }

        db.IvSnapshots.Add(snapshot);
        await db.SaveChangesAsync(ct);
        _logger.LogInformation(
            "IV snapshot saved for {Underlying}: ATM={AtmStrike} IV={AtmIv:F2}% Expiry={Expiry}",
            name, atm.StrikePrice, atmIv, expiry);
    }
}
