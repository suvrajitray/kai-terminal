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
    public async Task<PlaceOrderResult> PlaceOrderByOptionPriceAsync(
        PlaceOrderByOptionPriceRequest request, CancellationToken cancellationToken = default)
    {
        var instrumentToken = await ResolveByPremiumAsync(request, cancellationToken);
        var orderReq = BuildOrderRequest(request, instrumentToken);
        return await _http.PlaceOrderV2Async(orderReq, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<PlaceOrderV3Result> PlaceOrderByOptionPriceV3Async(
        PlaceOrderByOptionPriceRequest request, CancellationToken cancellationToken = default)
    {
        var instrumentToken = await ResolveByPremiumAsync(request, cancellationToken);
        var orderReq = BuildOrderRequest(request, instrumentToken, slice: request.Slice);
        return await _http.PlaceOrderV3Async(orderReq, cancellationToken);
    }

    // ──────────────────────────────────────────────────────────
    // Feature 8: Place Order by Strike Type
    // ──────────────────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<PlaceOrderResult> PlaceOrderByStrikeAsync(
        PlaceOrderByStrikeRequest request, CancellationToken cancellationToken = default)
    {
        var instrumentToken = await ResolveByStrikeTypeAsync(request, cancellationToken);
        var orderReq = BuildOrderRequest(request, instrumentToken);
        return await _http.PlaceOrderV2Async(orderReq, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<PlaceOrderV3Result> PlaceOrderByStrikeV3Async(
        PlaceOrderByStrikeRequest request, CancellationToken cancellationToken = default)
    {
        var instrumentToken = await ResolveByStrikeTypeAsync(request, cancellationToken);
        var orderReq = BuildOrderRequest(request, instrumentToken, slice: request.Slice);
        return await _http.PlaceOrderV3Async(orderReq, cancellationToken);
    }

    // ──────────────────────────────────────────────────────────
    // Strike resolution helpers
    // ──────────────────────────────────────────────────────────

    /// <summary>
    /// Fetches the option chain and returns the instrument key of the strike
    /// whose LTP is closest to the target premium.
    /// </summary>
    private async Task<string> ResolveByPremiumAsync(
        PlaceOrderByOptionPriceRequest request, CancellationToken ct)
    {
        var chain = await _http.GetOptionChainAsync(request.UnderlyingKey, request.ExpiryDate, ct);

        if (chain.Count == 0)
            throw new UpstoxException(
                $"Option chain returned no data for {request.UnderlyingKey} expiry {request.ExpiryDate}.");

        OptionSide? bestSide = null;
        decimal bestDiff = decimal.MaxValue;

        foreach (var entry in chain)
        {
            var side = request.OptionType == OptionType.CE ? entry.CallOptions : entry.PutOptions;
            if (side?.MarketData is null) continue;

            var diff = Math.Abs(side.MarketData.Ltp - request.TargetPremium);
            if (diff < bestDiff)
            {
                bestDiff = diff;
                bestSide = side;
            }
        }

        if (bestSide is null)
            throw new UpstoxException(
                $"No valid {request.OptionType} option found with LTP data in the chain.");

        return bestSide.InstrumentKey;
    }

    /// <summary>
    /// Fetches the option chain, determines the ATM strike, walks n strikes in the
    /// correct OTM/ITM direction and returns the instrument key.
    /// </summary>
    private async Task<string> ResolveByStrikeTypeAsync(
        PlaceOrderByStrikeRequest request, CancellationToken ct)
    {
        var chain = await _http.GetOptionChainAsync(request.UnderlyingKey, request.ExpiryDate, ct);

        if (chain.Count == 0)
            throw new UpstoxException(
                $"Option chain returned no data for {request.UnderlyingKey} expiry {request.ExpiryDate}.");

        // Sort strikes ascending.
        var sorted = chain
            .Where(e => (request.OptionType == OptionType.CE ? e.CallOptions : e.PutOptions) is not null)
            .OrderBy(e => e.StrikePrice)
            .ToList();

        if (sorted.Count == 0)
            throw new UpstoxException(
                $"No {request.OptionType} options found in the chain.");

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

        int offset = StrikeOffset(request.StrikeType);

        // For CE: OTM = higher strikes (positive offset), ITM = lower strikes (negative offset)
        // For PE: OTM = lower strikes (negative offset), ITM = higher strikes (positive offset)
        int targetIndex = request.OptionType == OptionType.CE
            ? atmIndex + offset
            : atmIndex - offset;

        targetIndex = Math.Clamp(targetIndex, 0, sorted.Count - 1);

        var targetEntry = sorted[targetIndex];
        var targetSide = request.OptionType == OptionType.CE
            ? targetEntry.CallOptions
            : targetEntry.PutOptions;

        if (targetSide is null)
            throw new UpstoxException(
                $"No {request.OptionType} contract found at strike {targetEntry.StrikePrice}.");

        return targetSide.InstrumentKey;
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
