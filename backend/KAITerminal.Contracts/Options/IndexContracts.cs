namespace KAITerminal.Contracts.Options;

/// <summary>All CE/PE contracts for one index, in a broker-agnostic format.</summary>
public sealed record IndexContracts(string Index, IReadOnlyList<ContractEntry> Contracts);

/// <summary>A single option contract in the unified KAI Terminal format.</summary>
public sealed record ContractEntry(
    string  Expiry,
    string  ExchangeToken,
    decimal LotSize,
    string  InstrumentType,
    string  UpstoxToken,    // e.g. "NSE_FO|37590"          — empty for Zerodha-only rows
    string  ZerodhaToken,   // tradingsymbol for Zerodha orders, e.g. "NIFTY2641320700PE" — empty for Upstox-only rows
    decimal StrikePrice
);
