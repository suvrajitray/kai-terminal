using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Models;

namespace KAITerminal.Worker;

internal enum ShiftDecisionKind { Shift, ExitExhausted, SkipContractNotFound, SkipUnknownUnderlying }

/// <summary>
/// The outcome of evaluating a single sell position for auto-shift.
/// </summary>
internal sealed record PositionShiftDecision(
    ShiftDecisionKind Kind,
    BrokerPosition Position,
    decimal Ltp,
    ZerodhaOptionContract? Contract,  // null for Skip kinds
    string? ChainKey,       // null for Skip kinds
    int ShiftCount,         // 0 for Skip kinds
    string? UnderlyingKey,  // non-null only when Kind == Shift (the Upstox index key)
    int StrikeGap,          // signed (positive=CE OTM, negative=PE OTM), only when Kind == Shift
    bool IsShiftedLeg = false,   // true when the position itself was created by a previous shift
    int MaxShiftCount = 0);      // config.AutoShiftMaxCount; populated for Shift and ExitExhausted
