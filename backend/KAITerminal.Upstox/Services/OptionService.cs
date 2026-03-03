using KAITerminal.Upstox.Exceptions;
using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

internal sealed class OptionService : IOptionService
{
    private readonly UpstoxHttpClient _http;

    public OptionService(UpstoxHttpClient http)
    {
        _http = http;
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<OptionChainEntry>> GetOptionChainAsync(
        string underlyingKey, string expiryDate, CancellationToken cancellationToken = default)
        => _http.GetOptionChainAsync(underlyingKey, expiryDate, cancellationToken);

    /// <inheritdoc />
    public Task<IReadOnlyList<OptionContract>> GetOptionContractsAsync(
        string underlyingKey, string? expiryDate = null, CancellationToken cancellationToken = default)
        => _http.GetOptionContractsAsync(underlyingKey, expiryDate, cancellationToken);

    // ──────────────────────────────────────────────────────────
    // Feature 7: Place Order by Option Price
    // ──────────────────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<OptionChainEntry> GetOrderByOptionPriceAsync(
        string underlyingKey, string expiryDate, OptionType optionType,
        decimal targetPremium, PriceSearchMode priceSearchMode = PriceSearchMode.Nearest,
        CancellationToken cancellationToken = default)
        => await ResolveByPremiumAsync(underlyingKey, expiryDate, optionType, targetPremium, priceSearchMode, cancellationToken);

    /// <inheritdoc />
    public async Task<PlaceOrderResult> PlaceOrderByOptionPriceAsync(
        PlaceOrderByOptionPriceRequest request, CancellationToken cancellationToken = default)
    {
        var entry = await ResolveByPremiumAsync(request.UnderlyingKey, request.ExpiryDate, request.OptionType, request.TargetPremium, request.PriceSearchMode, cancellationToken);
        var orderReq = BuildOrderRequest(request, InstrumentKey(entry, request.OptionType));
        return await _http.PlaceOrderV2Async(orderReq, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<PlaceOrderV3Result> PlaceOrderByOptionPriceV3Async(
        PlaceOrderByOptionPriceRequest request, CancellationToken cancellationToken = default)
    {
        var entry = await ResolveByPremiumAsync(request.UnderlyingKey, request.ExpiryDate, request.OptionType, request.TargetPremium, request.PriceSearchMode, cancellationToken);
        var orderReq = BuildOrderRequest(request, InstrumentKey(entry, request.OptionType), slice: request.Slice);
        return await _http.PlaceOrderV3Async(orderReq, cancellationToken);
    }

    // ──────────────────────────────────────────────────────────
    // Feature 8: Place Order by Strike Type
    // ──────────────────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<OptionChainEntry> GetOrderByStrikeAsync(
        string underlyingKey, string expiryDate, OptionType optionType, StrikeType strikeType,
        CancellationToken cancellationToken = default)
        => await ResolveByStrikeTypeAsync(underlyingKey, expiryDate, optionType, strikeType, cancellationToken);

    /// <inheritdoc />
    public async Task<PlaceOrderResult> PlaceOrderByStrikeAsync(
        PlaceOrderByStrikeRequest request, CancellationToken cancellationToken = default)
    {
        var entry = await ResolveByStrikeTypeAsync(request.UnderlyingKey, request.ExpiryDate, request.OptionType, request.StrikeType, cancellationToken);
        var orderReq = BuildOrderRequest(request, InstrumentKey(entry, request.OptionType));
        return await _http.PlaceOrderV2Async(orderReq, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<PlaceOrderV3Result> PlaceOrderByStrikeV3Async(
        PlaceOrderByStrikeRequest request, CancellationToken cancellationToken = default)
    {
        var entry = await ResolveByStrikeTypeAsync(request.UnderlyingKey, request.ExpiryDate, request.OptionType, request.StrikeType, cancellationToken);
        var orderReq = BuildOrderRequest(request, InstrumentKey(entry, request.OptionType), slice: request.Slice);
        return await _http.PlaceOrderV3Async(orderReq, cancellationToken);
    }

    // ──────────────────────────────────────────────────────────
    // Strike resolution helpers
    // ──────────────────────────────────────────────────────────

    /// <summary>
    /// Fetches the option chain and returns the chain entry of the strike that best
    /// matches <paramref name="targetPremium"/> according to <paramref name="priceSearchMode"/>.
    /// </summary>
    private async Task<OptionChainEntry> ResolveByPremiumAsync(
        string underlyingKey, string expiryDate, OptionType optionType,
        decimal targetPremium, PriceSearchMode priceSearchMode, CancellationToken ct)
    {
        var chain = await _http.GetOptionChainAsync(underlyingKey, expiryDate, ct);

        if (chain.Count == 0)
            throw new UpstoxException(
                $"Option chain returned no data for {underlyingKey} expiry {expiryDate}.");

        OptionChainEntry? best = priceSearchMode switch
        {
            PriceSearchMode.Nearest     => FindNearest(chain, optionType, targetPremium),
            PriceSearchMode.GreaterThan => FindGreaterThan(chain, optionType, targetPremium),
            PriceSearchMode.LessThan    => FindLessThan(chain, optionType, targetPremium),
            _ => throw new ArgumentOutOfRangeException(nameof(priceSearchMode))
        };

        if (best is null)
            throw new UpstoxException(
                $"No valid {optionType} option found with LTP {priceSearchMode} {targetPremium} in the chain.");

        return best;
    }

    /// <summary>Returns the entry whose LTP is closest to the target premium.</summary>
    private static OptionChainEntry? FindNearest(
        IReadOnlyList<OptionChainEntry> chain, OptionType optionType, decimal targetPremium)
    {
        OptionChainEntry? best = null;
        decimal bestDiff = decimal.MaxValue;

        foreach (var entry in chain)
        {
            var side = optionType == OptionType.CE ? entry.CallOptions : entry.PutOptions;
            if (side?.MarketData is null) continue;

            var diff = Math.Abs(side.MarketData.Ltp - targetPremium);
            if (diff < bestDiff)
            {
                bestDiff = diff;
                best = entry;
            }
        }

        return best;
    }

    /// <summary>Returns the entry with the smallest LTP that is strictly above the target premium.</summary>
    private static OptionChainEntry? FindGreaterThan(
        IReadOnlyList<OptionChainEntry> chain, OptionType optionType, decimal targetPremium)
    {
        OptionChainEntry? best = null;
        decimal bestLtp = decimal.MaxValue;

        foreach (var entry in chain)
        {
            var side = optionType == OptionType.CE ? entry.CallOptions : entry.PutOptions;
            if (side?.MarketData is null) continue;

            var ltp = side.MarketData.Ltp;
            if (ltp > targetPremium && ltp < bestLtp)
            {
                bestLtp = ltp;
                best = entry;
            }
        }

        return best;
    }

    /// <summary>Returns the entry with the largest LTP that is strictly below the target premium.</summary>
    private static OptionChainEntry? FindLessThan(
        IReadOnlyList<OptionChainEntry> chain, OptionType optionType, decimal targetPremium)
    {
        OptionChainEntry? best = null;
        decimal bestLtp = decimal.MinValue;

        foreach (var entry in chain)
        {
            var side = optionType == OptionType.CE ? entry.CallOptions : entry.PutOptions;
            if (side?.MarketData is null) continue;

            var ltp = side.MarketData.Ltp;
            if (ltp < targetPremium && ltp > bestLtp)
            {
                bestLtp = ltp;
                best = entry;
            }
        }

        return best;
    }

    /// <summary>
    /// Fetches the option chain, determines the ATM strike, walks n strikes in the
    /// correct OTM/ITM direction and returns the matched chain entry.
    /// </summary>
    private async Task<OptionChainEntry> ResolveByStrikeTypeAsync(
        string underlyingKey, string expiryDate, OptionType optionType, StrikeType strikeType,
        CancellationToken ct)
    {
        var chain = await _http.GetOptionChainAsync(underlyingKey, expiryDate, ct);

        if (chain.Count == 0)
            throw new UpstoxException(
                $"Option chain returned no data for {underlyingKey} expiry {expiryDate}.");

        // Sort strikes ascending.
        var sorted = chain
            .Where(e => (optionType == OptionType.CE ? e.CallOptions : e.PutOptions) is not null)
            .OrderBy(e => e.StrikePrice)
            .ToList();

        if (sorted.Count == 0)
            throw new UpstoxException(
                $"No {optionType} options found in the chain.");

        var spotPrice = chain[0].UnderlyingSpotPrice;

        // Find the ATM index: strike closest to spot price.
        int atmIndex = 0;
        decimal minDiff = decimal.MaxValue;
        for (int i = 0; i < sorted.Count; i++)
        {
            var diff = Math.Abs(sorted[i].StrikePrice - spotPrice);
            if (diff < minDiff)
            {
                minDiff = diff;
                atmIndex = i;
            }
        }

        int offset = StrikeOffset(strikeType);

        // For CE: OTM = higher strikes (positive offset), ITM = lower strikes (negative offset)
        // For PE: OTM = lower strikes (negative offset), ITM = higher strikes (positive offset)
        int targetIndex = optionType == OptionType.CE
            ? atmIndex + offset
            : atmIndex - offset;

        targetIndex = Math.Clamp(targetIndex, 0, sorted.Count - 1);

        var targetEntry = sorted[targetIndex];
        var targetSide = optionType == OptionType.CE
            ? targetEntry.CallOptions
            : targetEntry.PutOptions;

        if (targetSide is null)
            throw new UpstoxException(
                $"No {optionType} contract found at strike {targetEntry.StrikePrice}.");

        return targetEntry;
    }

    /// <summary>Maps a <see cref="StrikeType"/> to a signed strike offset from ATM.</summary>
    private static int StrikeOffset(StrikeType strikeType) => strikeType switch
    {
        StrikeType.ATM => 0,
        StrikeType.OTM1 => 1,
        StrikeType.OTM2 => 2,
        StrikeType.OTM3 => 3,
        StrikeType.OTM4 => 4,
        StrikeType.OTM5 => 5,
        StrikeType.ITM1 => -1,
        StrikeType.ITM2 => -2,
        StrikeType.ITM3 => -3,
        StrikeType.ITM4 => -4,
        StrikeType.ITM5 => -5,
        _ => throw new ArgumentOutOfRangeException(nameof(strikeType), strikeType, null)
    };

    // ──────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────

    private static string InstrumentKey(OptionChainEntry entry, OptionType optionType)
    {
        var side = optionType == OptionType.CE ? entry.CallOptions : entry.PutOptions;
        if (side is null)
            throw new UpstoxException(
                $"No {optionType} contract found at strike {entry.StrikePrice}.");
        return side.InstrumentKey;
    }

    // ──────────────────────────────────────────────────────────
    // PlaceOrderRequest builders
    // ──────────────────────────────────────────────────────────

    private static PlaceOrderRequest BuildOrderRequest(
        PlaceOrderByOptionPriceRequest r, string instrumentToken, bool slice = false)
        => new()
        {
            InstrumentToken = instrumentToken,
            Quantity = r.Quantity,
            TransactionType = r.TransactionType,
            OrderType = r.OrderType,
            Product = r.Product,
            Validity = r.Validity,
            Price = r.Price,
            TriggerPrice = r.TriggerPrice,
            IsAmo = r.IsAmo,
            Tag = r.Tag,
            Slice = slice
        };

    private static PlaceOrderRequest BuildOrderRequest(
        PlaceOrderByStrikeRequest r, string instrumentToken, bool slice = false)
        => new()
        {
            InstrumentToken = instrumentToken,
            Quantity = r.Quantity,
            TransactionType = r.TransactionType,
            OrderType = r.OrderType,
            Product = r.Product,
            Validity = r.Validity,
            Price = r.Price,
            TriggerPrice = r.TriggerPrice,
            IsAmo = r.IsAmo,
            Tag = r.Tag,
            Slice = slice
        };
}
