using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Upstox.Services;
using Microsoft.Extensions.Logging;

namespace KAITerminal.SimConsole.Simulation;

/// <summary>No-op order service — logs actions, never touches a real broker.</summary>
public sealed class SimOrderService : IOrderService
{
    private readonly ILogger<SimOrderService> _logger;
    public SimOrderService(ILogger<SimOrderService> logger) => _logger = logger;

    public Task<IReadOnlyList<Order>> GetAllOrdersAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<Order>>([]);

    public Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<string>>([]);

    public Task<string> CancelOrderAsync(string orderId, CancellationToken cancellationToken = default)
        => Task.FromResult($"SIM-CANCEL-{orderId}");

    public Task<(string OrderId, int Latency)> CancelOrderV3Async(string orderId, CancellationToken cancellationToken = default)
        => Task.FromResult(($"SIM-CANCEL-{orderId}", 1));

    public Task<PlaceOrderResult> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken cancellationToken = default)
    {
        var id = $"SIM-{Guid.NewGuid().ToString("N")[..8]}";
        _logger.LogInformation("[SIM] PlaceOrder: {TxType} {Symbol} qty={Qty} → orderId={Id}",
            request.TransactionType, request.InstrumentToken, request.Quantity, id);
        return Task.FromResult(new PlaceOrderResult { OrderId = id });
    }

    public Task<PlaceOrderV3Result> PlaceOrderV3Async(PlaceOrderRequest request, CancellationToken cancellationToken = default)
    {
        var id = $"SIM-{Guid.NewGuid().ToString("N")[..8]}";
        _logger.LogInformation("[SIM] PlaceOrderV3: {TxType} {Symbol} qty={Qty} → orderId={Id}",
            request.TransactionType, request.InstrumentToken, request.Quantity, id);
        return Task.FromResult(new PlaceOrderV3Result { OrderIds = [id], Latency = 1 });
    }
}
