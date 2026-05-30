using KAITerminal.Broker;
using KAITerminal.OrderRouting;
using KAITerminal.RollingStraddle.Configuration;
using KAITerminal.Upstox.Configuration;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RollingStraddle.Services;

internal sealed class OrderExecutor
{
    private readonly IOrderRouter        _router;
    private readonly IBrokerOrderService _orders;
    private readonly string              _username;
    private readonly string              _accessToken;
    private readonly ILogger<OrderExecutor> _logger;

    private const string OrderTag       = "KAI_TERMINAL_RS";
    private const int    FillTimeoutSec = 60;
    private const int    FillPollMs     = 500;

    public OrderExecutor(
        IOrderRouter            router,
        IBrokerOrderService     orders,
        IOptions<StrategyConfig> strategyConfig,
        IOptions<UpstoxConfig>   upstoxConfig,
        ILogger<OrderExecutor>  log)
    {
        _router      = router;
        _orders      = orders;
        _username    = strategyConfig.Value.Username;
        _accessToken = upstoxConfig.Value.AccessToken ?? "";
        _logger         = log;
    }

    internal Task<string> SellMarketAsync(string token, int qty, CancellationToken ct) =>
        PlaceAsync(token, qty, TransactionType.Sell, ct);

    internal Task<string> BuyMarketAsync(string token, int qty, CancellationToken ct) =>
        PlaceAsync(token, qty, TransactionType.Buy, ct);

    internal Task CancelAllPendingAsync(CancellationToken ct) =>
        _router.CancelAllUpstoxOrdersAsync(_username, _accessToken, ct);

    private async Task<string> PlaceAsync(string token, int qty, TransactionType side, CancellationToken ct)
    {
        var request = new PlaceOrderRequest
        {
            InstrumentToken = token,
            Quantity        = qty,
            TransactionType = side,
            OrderType       = OrderType.Market,
            Product         = Product.Intraday,
            Slice           = true,
            Tag             = OrderTag
        };
        var result = await _router.PlaceUpstoxOrderAsync(_username, _accessToken, request, ct);
        return string.Join(",", result.OrderIds);
    }

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
                        _logger.LogError("[FILL ] {Label} {Id} {Status} — {Msg}",
                            label, rejected.OrderId, rejected.Status, rejected.StatusMessage);
                        return 0m;
                    }

                    if (matched.All(o => o.Status == "complete"))
                    {
                        var totalQty = matched.Sum(o => o.FilledQuantity);
                        var avgPrice = totalQty > 0
                            ? matched.Sum(o => o.AveragePrice * o.FilledQuantity) / totalQty
                            : 0m;
                        _logger.LogInformation("[FILL ] {Label} {Id} filled @ ₹{Avg:F2}", label, orderId, avgPrice);
                        return avgPrice;
                    }

                    var statuses = string.Join(", ", matched.Select(o => o.Status).Distinct());
                    _logger.LogInformation("[FILL ] {Label} {Id} {Statuses} — waiting...", label, orderId, statuses);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[FILL ] Error checking {Label} order {Id} — retrying", label, orderId);
            }
            await Task.Delay(FillPollMs, ct);
        }

        _logger.LogWarning("[FILL ] {Label} {Id} did not confirm within {Sec}s — proceeding",
            label, orderId, FillTimeoutSec);
        return 0m;
    }
}
