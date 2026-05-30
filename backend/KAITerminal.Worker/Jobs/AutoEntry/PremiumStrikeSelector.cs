using KAITerminal.Contracts.Options;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker.Jobs.AutoEntry;

internal sealed class PremiumStrikeSelector : IStrikeSelector
{
    private readonly IOptionChainProvider            _chainProvider;
    private readonly ILogger<PremiumStrikeSelector>  _logger;

    public PremiumStrikeSelector(
        IOptionChainProvider            chainProvider,
        ILogger<PremiumStrikeSelector>  logger)
    {
        _chainProvider = chainProvider;
        _logger        = logger;
    }

    public string Mode => "Premium";

    public async Task<StrikeResolution?> SelectAsync(StrikeSelectionContext ctx, CancellationToken ct)
    {
        if (!WorkerIndexKeys.UnderlyingFeedKeys.TryGetValue(
            ctx.Config.Instrument.ToUpperInvariant(), out var underlyingKey))
            return null;

        IReadOnlyList<OptionChainEntry> chain;
        try
        {
            chain = await _chainProvider.GetChainAsync(underlyingKey, ctx.Expiry, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ERROR] Premium chain fetch failed — {Instrument}", ctx.Config.Instrument);
            return null;
        }

        var targetPremium = ctx.Config.StrikeParam;
        var isCe          = ctx.OptionType.Equals("CE", StringComparison.OrdinalIgnoreCase);

        var best = chain
            .Select(e => (entry: e, side: isCe ? e.CallOptions : e.PutOptions))
            .Where(x => x.side?.MarketData is not null && !string.IsNullOrEmpty(x.side.InstrumentKey))
            .MinBy(x => Math.Abs(x.side!.MarketData!.Ltp - targetPremium));

        if (best == default) return null;

        _logger.LogInformation(
            "[ENTRY] Premium — {OptionType} strike={Strike}  |  ltp=₹{Ltp} (target=₹{Target})  [{User} / {Broker}]",
            ctx.OptionType, best.entry.StrikePrice, best.side!.MarketData!.Ltp, targetPremium,
            ctx.Config.Username, ctx.Config.BrokerType);

        return BrokerTokenResolver.FromUpstoxKey(
            best.side!.InstrumentKey, ctx.Config.BrokerType, ctx.Contracts, ctx.Config.Instrument);
    }
}
