using KAITerminal.Api.Contracts.Enums;
using KAITerminal.Api.Contracts.Responses;

namespace KAITerminal.Api.Mapping;

internal static class PositionMapper
{
    /// <summary>Maps a broker-agnostic domain position to the unified API response DTO.</summary>
    internal static PositionResponse ToResponse(
        this KAITerminal.Contracts.Domain.BrokerPosition p)
        => new()
        {
            Exchange        = p.Exchange,
            InstrumentToken = p.InstrumentToken,
            TradingSymbol   = p.TradingSymbol,
            Product         = ParseProduct(p.Product),
            Quantity        = p.Quantity,
            BuyQuantity     = p.BuyQuantity,
            SellQuantity    = p.SellQuantity,
            AveragePrice    = p.AveragePrice,
            Ltp             = p.Ltp,
            Pnl             = p.Pnl,
            Unrealised      = p.Unrealised,
            Realised        = p.Realised,
            BuyPrice        = p.BuyPrice,
            SellPrice       = p.SellPrice,
            BuyValue        = p.BuyValue,
            SellValue       = p.SellValue,
            Broker          = p.Broker ?? "upstox",
            IsOpen          = p.IsOpen,
        };

    /// <summary>Maps an Upstox-specific order to the unified API response DTO.</summary>
    internal static OrderResponse ToResponse(
        this KAITerminal.Upstox.Models.Responses.Order o)
        => new()
        {
            OrderId         = o.OrderId,
            ExchangeOrderId = o.ExchangeOrderId,
            Exchange        = o.Exchange,
            TradingSymbol   = o.TradingSymbol,
            Product         = ParseProduct(o.Product),
            OrderType       = ParseOrderType(o.OrderType),
            TransactionType = ParseOrderSide(o.TransactionType),
            Validity        = ParseValidity(o.Validity),
            Status          = o.Status,
            StatusMessage   = o.StatusMessage,
            Price           = o.Price,
            AveragePrice    = o.AveragePrice,
            Quantity        = o.Quantity,
            FilledQuantity  = o.FilledQuantity,
            PendingQuantity = o.PendingQuantity,
            Tag             = o.Tag,
            OrderTimestamp  = o.OrderTimestamp,
        };

    // ── Parsers ────────────────────────────────────────────────────────────────

    private static ProductType ParseProduct(string raw) => raw.ToUpperInvariant() switch
    {
        "D" or "CNC" or "NRML" => ProductType.Delivery,
        "MTF"                  => ProductType.Mtf,
        "CO"                   => ProductType.CoverOrder,
        _                      => ProductType.Intraday,   // "I", "MIS"
    };

    private static TradeOrderType ParseOrderType(string raw) => raw.ToUpperInvariant() switch
    {
        "LIMIT"  => TradeOrderType.Limit,
        "SL"     => TradeOrderType.StopLoss,
        "SL-M"   => TradeOrderType.StopLossMarket,
        _        => TradeOrderType.Market,
    };

    private static OrderSide ParseOrderSide(string raw) =>
        raw.Equals("SELL", StringComparison.OrdinalIgnoreCase)
            ? OrderSide.Sell
            : OrderSide.Buy;

    private static OrderValidity ParseValidity(string raw) =>
        raw.Equals("IOC", StringComparison.OrdinalIgnoreCase)
            ? OrderValidity.IOC
            : OrderValidity.Day;
}
