using KAITerminal.Contracts.Options;
using KAITerminal.Infrastructure.Data;

namespace KAITerminal.Worker.Jobs.AutoEntry;

internal sealed record StrikeSelectionContext(
    AutoEntryConfig              Config,
    string                       OptionType,
    string                       Expiry,
    decimal                      Spot,
    IReadOnlyList<ContractEntry> Contracts);
