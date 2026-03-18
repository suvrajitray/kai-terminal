namespace KAITerminal.Api.Models;

/// <summary>All CE/PE contracts for one index, in a broker-agnostic format.</summary>
public sealed record IndexContracts(string Index, IReadOnlyList<ContractEntry> Contracts);

/// <summary>A single option contract in the unified KAI Terminal format.</summary>
public sealed record ContractEntry(
    string Expiry,
    string ExchangeToken,
    decimal LotSize,
    string InstrumentType,
    string UpstoxToken,       // e.g. "NSE_FO|37590"  — empty for Zerodha rows
    string ZerodhaToken,    // e.g. "13238786"  — empty for Upstox rows
    decimal StrikePrice
);
