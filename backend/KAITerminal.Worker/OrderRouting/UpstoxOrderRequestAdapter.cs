using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;

namespace KAITerminal.Worker.OrderRouting;

/// <summary>
/// Pure adapter mapping a generic <see cref="BrokerOrderRequest"/> to the
/// Upstox-specific <see cref="PlaceOrderRequest"/>. No I/O.
/// </summary>
internal static class UpstoxOrderRequestAdapter
{
    public static PlaceOrderRequest From(BrokerOrderRequest request) =>
        new()
        {
            InstrumentToken = request.InstrumentToken,
            Quantity        = request.Quantity,
            TransactionType = ParseTransactionType(request.TransactionType),
            OrderType       = ParseOrderType(request.OrderType),
            Product         = UpstoxProductMap.ToEnum(request.Product),
            Price           = request.Price ?? 0,
            Tag             = request.Tag,
            Slice           = true,
        };

    private static TransactionType ParseTransactionType(string value) =>
        value.Equals("BUY", StringComparison.OrdinalIgnoreCase)
            ? TransactionType.Buy
            : TransactionType.Sell;

    private static OrderType ParseOrderType(string value) =>
        value.Equals("LIMIT", StringComparison.OrdinalIgnoreCase)
            ? OrderType.Limit
            : OrderType.Market;
}
