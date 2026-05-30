using KAITerminal.Contracts.Options;

namespace KAITerminal.Worker.Jobs.AutoEntry;

internal sealed class AtmStrikeSelector : IStrikeSelector
{
    public string Mode => "ATM";

    public Task<StrikeResolution?> SelectAsync(StrikeSelectionContext ctx, CancellationToken ct)
    {
        var filtered = FilterByExpiryAndType(ctx);
        if (filtered.Count == 0) return Task.FromResult<StrikeResolution?>(null);

        var entry = filtered.MinBy(c => Math.Abs(c.StrikePrice - ctx.Spot));
        if (entry is null) return Task.FromResult<StrikeResolution?>(null);

        return Task.FromResult(
            BrokerTokenResolver.FromContract(entry, ctx.Config.BrokerType, ctx.Config.Instrument));
    }

    internal static List<ContractEntry> FilterByExpiryAndType(StrikeSelectionContext ctx) =>
        ctx.Contracts
            .Where(c => c.Expiry == ctx.Expiry
                && c.InstrumentType.Equals(ctx.OptionType, StringComparison.OrdinalIgnoreCase))
            .OrderBy(c => c.StrikePrice)
            .ToList();
}
