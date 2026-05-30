using KAITerminal.Contracts.Options;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker.Jobs.AutoEntry;

internal sealed class DeltaStrikeSelector : IStrikeSelector
{
    private readonly IOptionChainProvider          _chainProvider;
    private readonly ILogger<DeltaStrikeSelector>  _logger;

    public DeltaStrikeSelector(
        IOptionChainProvider          chainProvider,
        ILogger<DeltaStrikeSelector>  logger)
    {
        _chainProvider = chainProvider;
        _logger        = logger;
    }

    public string Mode => "Delta";

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
            _logger.LogError(ex, "[ERROR] Delta chain fetch failed — {Instrument}", ctx.Config.Instrument);
            return null;
        }

        var targetDelta = (double)ctx.Config.StrikeParam;
        var isCe        = ctx.OptionType.Equals("CE", StringComparison.OrdinalIgnoreCase);

        var best = chain
            .Select(e => (entry: e, side: isCe ? e.CallOptions : e.PutOptions))
            .Where(x => x.side?.OptionGreeks is not null && !string.IsNullOrEmpty(x.side.InstrumentKey))
            .MinBy(x => Math.Abs(Math.Abs((double)x.side!.OptionGreeks!.Delta) - targetDelta));

        if (best == default) return null;

        _logger.LogInformation(
            "[ENTRY] Delta — {OptionType} strike={Strike}  |  delta={Delta:F3} (target={Target})  [{User} / {Broker}]",
            ctx.OptionType, best.entry.StrikePrice, best.side!.OptionGreeks!.Delta, targetDelta,
            ctx.Config.Username, ctx.Config.BrokerType);

        return BrokerTokenResolver.FromUpstoxKey(
            best.side!.InstrumentKey, ctx.Config.BrokerType, ctx.Contracts, ctx.Config.Instrument);
    }
}
