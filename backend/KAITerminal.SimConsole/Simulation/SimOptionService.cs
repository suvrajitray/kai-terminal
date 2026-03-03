using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Upstox.Services;
using Microsoft.Extensions.Logging;

namespace KAITerminal.SimConsole.Simulation;

/// <summary>No-op option service — logs re-entry orders, never touches a real broker.</summary>
public sealed class SimOptionService : IOptionService
{
    private readonly ILogger<SimOptionService> _logger;
    public SimOptionService(ILogger<SimOptionService> logger) => _logger = logger;

    public Task<IReadOnlyList<OptionChainEntry>> GetOptionChainAsync(
        string underlyingKey, string expiryDate, CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<OptionChainEntry>>([]);

    public Task<IReadOnlyList<OptionContract>> GetOptionContractsAsync(
        string underlyingKey, string? expiryDate = null, CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<OptionContract>>([]);

    public Task<OptionChainEntry> GetOrderByOptionPriceAsync(
        string underlyingKey, string expiryDate, OptionType optionType,
        decimal targetPremium, PriceSearchMode priceSearchMode = PriceSearchMode.Nearest,
        CancellationToken cancellationToken = default)
        => Task.FromResult(new OptionChainEntry
        {
            UnderlyingKey = underlyingKey,
            Expiry = expiryDate,
        });

    public Task<PlaceOrderResult> PlaceOrderByOptionPriceAsync(
        PlaceOrderByOptionPriceRequest request, CancellationToken cancellationToken = default)
    {
        var id = $"SIM-{Guid.NewGuid().ToString("N")[..8]}";
        _logger.LogInformation("[SIM] PlaceOrderByOptionPrice: {Underlying} {Type} targetPremium={Premium} qty={Qty} → {Id}",
            request.UnderlyingKey, request.OptionType, request.TargetPremium, request.Quantity, id);
        return Task.FromResult(new PlaceOrderResult { OrderId = id });
    }

    public Task<PlaceOrderV3Result> PlaceOrderByOptionPriceV3Async(
        PlaceOrderByOptionPriceRequest request, CancellationToken cancellationToken = default)
        => PlaceOrderByOptionPriceAsync(request, cancellationToken)
            .ContinueWith(t => new PlaceOrderV3Result { OrderIds = [t.Result.OrderId], Latency = 1 }, cancellationToken);

    public Task<OptionChainEntry> GetOrderByStrikeAsync(
        string underlyingKey, string expiryDate, OptionType optionType, StrikeType strikeType,
        CancellationToken cancellationToken = default)
        => Task.FromResult(new OptionChainEntry
        {
            UnderlyingKey = underlyingKey,
            Expiry = expiryDate,
        });

    public Task<PlaceOrderResult> PlaceOrderByStrikeAsync(
        PlaceOrderByStrikeRequest request, CancellationToken cancellationToken = default)
    {
        var id = $"SIM-{Guid.NewGuid().ToString("N")[..8]}";
        _logger.LogInformation("[SIM] PlaceOrderByStrike: {Underlying} {Strike} {Type} qty={Qty} → {Id}",
            request.UnderlyingKey, request.StrikeType, request.OptionType, request.Quantity, id);
        return Task.FromResult(new PlaceOrderResult { OrderId = id });
    }

    public Task<PlaceOrderV3Result> PlaceOrderByStrikeV3Async(
        PlaceOrderByStrikeRequest request, CancellationToken cancellationToken = default)
    {
        var id = $"SIM-{Guid.NewGuid().ToString("N")[..8]}";
        _logger.LogInformation("[SIM] PlaceOrderByStrikeV3: {Underlying} {Strike} {Type} qty={Qty} → {Id}",
            request.UnderlyingKey, request.StrikeType, request.OptionType, request.Quantity, id);
        return Task.FromResult(new PlaceOrderV3Result { OrderIds = [id], Latency = 1 });
    }
}
