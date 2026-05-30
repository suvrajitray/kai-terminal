namespace KAITerminal.Worker.Jobs.AutoEntry;

internal sealed class StrikeSelectorRegistry
{
    private readonly IReadOnlyDictionary<string, IStrikeSelector> _byMode;
    private readonly IStrikeSelector                              _default;

    public StrikeSelectorRegistry(IEnumerable<IStrikeSelector> selectors)
    {
        _byMode  = selectors.ToDictionary(s => s.Mode, StringComparer.OrdinalIgnoreCase);
        _default = _byMode["ATM"];
    }

    public IStrikeSelector For(string mode) =>
        _byMode.TryGetValue(mode, out var s) ? s : _default;
}
