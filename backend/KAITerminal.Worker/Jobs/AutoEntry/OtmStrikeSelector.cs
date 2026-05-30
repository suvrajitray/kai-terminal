namespace KAITerminal.Worker.Jobs.AutoEntry;

internal sealed class OtmStrikeSelector : IStrikeSelector
{
    public string Mode => "OTM";

    public Task<StrikeResolution?> SelectAsync(StrikeSelectionContext ctx, CancellationToken ct)
    {
        var filtered = AtmStrikeSelector.FilterByExpiryAndType(ctx);
        if (filtered.Count == 0) return Task.FromResult<StrikeResolution?>(null);

        var atmIdx = filtered
            .Select((c, i) => (i, diff: Math.Abs(c.StrikePrice - ctx.Spot)))
            .MinBy(t => t.diff).i;

        // CE sellers want higher strikes (+steps); PE sellers want lower (-steps).
        var steps  = (int)ctx.Config.StrikeParam;
        var offset = ctx.OptionType.Equals("CE", StringComparison.OrdinalIgnoreCase) ? steps : -steps;
        var idx    = Math.Clamp(atmIdx + offset, 0, filtered.Count - 1);

        return Task.FromResult(
            BrokerTokenResolver.FromContract(filtered[idx], ctx.Config.BrokerType, ctx.Config.Instrument));
    }
}
