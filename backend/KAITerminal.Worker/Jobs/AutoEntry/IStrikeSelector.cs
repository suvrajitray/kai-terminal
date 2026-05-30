namespace KAITerminal.Worker.Jobs.AutoEntry;

internal interface IStrikeSelector
{
    string Mode { get; }

    Task<StrikeResolution?> SelectAsync(StrikeSelectionContext context, CancellationToken ct);
}
