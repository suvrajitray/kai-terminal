using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using Microsoft.Extensions.Logging;

namespace KAITerminal.RollingStraddle.Services;

internal sealed class OrderExecutor
{
    private readonly IBrokerOrderService    _orders;
    private readonly ILogger<OrderExecutor> _log;

    private const string OrderTag       = "KAI_TERMINAL_RS";
    private const int    FillTimeoutSec = 60;
    private const int    FillPollMs     = 500;

    public OrderExecutor(IBrokerOrderService orders, ILogger<OrderExecutor> log)
    {
        _orders = orders;
        _log    = log;
    }

    internal Task<string> SellMarketAsync(string token, int qty, CancellationToken ct) =>
        _orders.PlaceOrderAsync(
            new BrokerOrderRequest(token, qty, "SELL", "I", "MARKET", Tag: OrderTag), ct);

    internal Task<string> BuyMarketAsync(string token, int qty, CancellationToken ct) =>
        _orders.PlaceOrderAsync(
            new BrokerOrderRequest(token, qty, "BUY", "I", "MARKET", Tag: OrderTag), ct);

    internal Task CancelAllPendingAsync(CancellationToken ct) =>
        _orders.CancelAllPendingOrdersAsync(ct);

    internal async Task<decimal> WaitForFillAsync(string label, string orderId, CancellationToken ct)
    {
        // PlaceOrderAsync returns comma-separated IDs when Upstox slices a large order.
        // For 5-lot NIFTY quantities slicing won't happen, but handle it correctly regardless.
        var ids      = orderId.Split(',', StringSplitOptions.RemoveEmptyEntries);
        var deadline = DateTimeOffset.UtcNow.AddSeconds(FillTimeoutSec);

        while (DateTimeOffset.UtcNow < deadline && !ct.IsCancellationRequested)
        {
            try
            {
                var all     = await _orders.GetAllOrdersAsync(ct);
                var matched = all.Where(o => ids.Contains(o.OrderId)).ToList();

                if (matched.Count == ids.Length)
                {
                    var rejected = matched.FirstOrDefault(o => o.Status is "rejected" or "cancelled");
                    if (rejected is not null)
                    {
                        _log.LogError("[FILL ] {Label} {Id} {Status} — {Msg}",
                            label, rejected.OrderId, rejected.Status, rejected.StatusMessage);
                        return 0m;
                    }

                    if (matched.All(o => o.Status == "complete"))
                    {
                        var totalQty = matched.Sum(o => o.FilledQuantity);
                        var avgPrice = totalQty > 0
                            ? matched.Sum(o => o.AveragePrice * o.FilledQuantity) / totalQty
                            : 0m;
                        _log.LogInformation("[FILL ] {Label} {Id} filled @ ₹{Avg:F2}", label, orderId, avgPrice);
                        return avgPrice;
                    }

                    var statuses = string.Join(", ", matched.Select(o => o.Status).Distinct());
                    _log.LogInformation("[FILL ] {Label} {Id} {Statuses} — waiting...", label, orderId, statuses);
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "[FILL ] Error checking {Label} order {Id} — retrying", label, orderId);
            }
            await Task.Delay(FillPollMs, ct);
        }

        _log.LogWarning("[FILL ] {Label} {Id} did not confirm within {Sec}s — proceeding",
            label, orderId, FillTimeoutSec);
        return 0m;
    }
}
