using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Options;
using KAITerminal.MarketData.Models;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.Worker;

/// <summary>
/// Pure auto-shift decision logic — no I/O, no state mutation.
/// Call <see cref="FilterThresholdCrossings"/> first (no contracts needed),
/// then load contracts, then call <see cref="Evaluate"/> for actionable decisions.
/// </summary>
internal static class AutoShiftDecisionEngine
{
    // Underlying name (from Kite CSV) → Upstox index key (for option chain lookup)
    private static IReadOnlyDictionary<string, string> UnderlyingKeys => WorkerIndexKeys.UnderlyingFeedKeys;

    /// <summary>
    /// Returns sell positions whose live LTP has crossed the shift threshold.
    /// Positions already actioned this cycle (isShiftedThisCycle returns true) are excluded.
    /// </summary>
    public static IReadOnlyList<(BrokerPosition Position, decimal Ltp)> FilterThresholdCrossings(
        IReadOnlyList<BrokerPosition> sellPositions,
        Func<string, decimal?> getLiveLtp,        // instrumentToken → live ltp or null
        Func<string, bool> isShiftedThisCycle,    // instrumentToken → already actioned?
        UserConfig config)
    {
        var result = new List<(BrokerPosition Position, decimal Ltp)>();

        foreach (var position in sellPositions)
        {
            if (isShiftedThisCycle(position.InstrumentToken))
                continue;

            var ltp = getLiveLtp(position.InstrumentToken);
            if (ltp is null)
                continue;

            var threshold = position.AveragePrice * (1 + config.AutoShiftThresholdPct / 100m);
            if (ltp.Value < threshold)
                continue;

            result.Add((position, ltp.Value));
        }

        return result;
    }

    /// <summary>
    /// For each threshold crossing, determine the action: Shift, ExitExhausted, or a skip kind.
    /// </summary>
    public static IReadOnlyList<AutoShiftDecision> Evaluate(
        IReadOnlyList<(BrokerPosition Position, decimal Ltp)> crossings,
        UserRiskState state,
        UserConfig config,
        IReadOnlyList<ZerodhaOptionContract> contracts,
        string brokerType)
    {
        var result = new List<AutoShiftDecision>();

        foreach (var (position, ltp) in crossings)
        {
            var contract = LookupContract(position, brokerType, contracts);
            if (contract is null)
            {
                result.Add(new AutoShiftDecision(
                    AutoShiftDecisionKind.SkipContractNotFound,
                    position, ltp, null, null, 0, null, 0));
                continue;
            }

            // If this token was created by a previous shift, inherit the original leg's chain key
            var isShiftedPosition = state.ShiftOriginMap.TryGetValue(position.InstrumentToken, out var mapped);
            var chainKey = isShiftedPosition
                ? mapped!
                : $"{contract.Name}_{contract.Expiry}_{contract.InstrumentType}_{contract.Strike}";

            var shiftCount = state.AutoShiftCounts.GetValueOrDefault(chainKey, 0);

            if (shiftCount >= config.AutoShiftMaxCount)
            {
                // Guard: skip silently if we already placed an exhausted-exit order this session.
                if (state.ExitedChainKeys.Contains(chainKey))
                    continue;

                result.Add(new AutoShiftDecision(
                    AutoShiftDecisionKind.ExitExhausted,
                    position, ltp, contract, chainKey, shiftCount, null, 0,
                    IsShiftedLeg: false,
                    MaxShiftCount: config.AutoShiftMaxCount));
            }
            else
            {
                if (!UnderlyingKeys.TryGetValue(contract.Name, out var underlyingKey))
                {
                    result.Add(new AutoShiftDecision(
                        AutoShiftDecisionKind.SkipUnknownUnderlying,
                        position, ltp, contract, chainKey, shiftCount, null, 0));
                    continue;
                }

                var strikeGap = OptionInstrumentType.IsCe(contract.InstrumentType)
                    ? config.AutoShiftStrikeGap
                    : -config.AutoShiftStrikeGap;

                result.Add(new AutoShiftDecision(
                    AutoShiftDecisionKind.Shift,
                    position, ltp, contract, chainKey, shiftCount, underlyingKey, strikeGap,
                    IsShiftedLeg: isShiftedPosition,
                    MaxShiftCount: config.AutoShiftMaxCount));
            }
        }

        return result;
    }

    private static ZerodhaOptionContract? LookupContract(
        BrokerPosition position, string brokerType,
        IReadOnlyList<ZerodhaOptionContract> contracts)
    {
        if (string.Equals(brokerType, BrokerNames.Zerodha, StringComparison.OrdinalIgnoreCase))
        {
            return contracts.FirstOrDefault(c =>
                c.TradingSymbol.Equals(position.InstrumentToken, StringComparison.OrdinalIgnoreCase));
        }

        // Upstox token format: "{exchange}|{exchange_token}" e.g. "NSE_FO|12345678"
        var exchangeToken = position.InstrumentToken.Contains('|')
            ? position.InstrumentToken.Split('|')[1]
            : position.InstrumentToken;

        return contracts.FirstOrDefault(c =>
            c.ExchangeToken.Equals(exchangeToken, StringComparison.OrdinalIgnoreCase));
    }
}
