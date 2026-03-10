using KAITerminal.Upstox.Exceptions;
using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

internal sealed class PositionService : IPositionService
{
    private readonly UpstoxHttpClient _http;

    public PositionService(UpstoxHttpClient http)
    {
        _http = http;
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<Position>> GetAllPositionsAsync(CancellationToken cancellationToken = default)
        => _http.GetPositionsAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<decimal> GetTotalMtmAsync(CancellationToken cancellationToken = default)
    {
        var positions = await GetAllPositionsAsync(cancellationToken);
        return positions.Sum(p => p.Pnl);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<string>> ExitAllPositionsAsync(
        IReadOnlyCollection<string>? exchanges = null,
        CancellationToken cancellationToken = default)
    {
        var positions = await GetAllPositionsAsync(cancellationToken);
        var filter = (exchanges is null || exchanges.Count == 0)
            ? ["NFO", "BFO"]
            : exchanges;

        var openPositions = positions
            .Where(p => p.IsOpen)
            .Where(p => filter.Contains(p.Exchange, StringComparer.OrdinalIgnoreCase))
            .ToList();

        if (openPositions.Count == 0)
            return [];

        var tasks = openPositions.Select(p => ExitSingleAsync(p, cancellationToken));
        var results = await Task.WhenAll(tasks);
        return results.ToList().AsReadOnly();
    }

    /// <inheritdoc />
    public async Task<string> ExitPositionAsync(
        string instrumentToken,
        string product,
        CancellationToken cancellationToken = default)
    {
        var positions = await GetAllPositionsAsync(cancellationToken);
        var position = positions.FirstOrDefault(p =>
            string.Equals(p.InstrumentToken, instrumentToken, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(p.Product, product, StringComparison.OrdinalIgnoreCase));

        if (position is null)
            throw new UpstoxException($"Position not found for instrument token: {instrumentToken}, product: {product}");

        if (!position.IsOpen)
            throw new UpstoxException($"Position for {instrumentToken}/{product} is already closed (quantity = 0).");

        return await ExitSingleAsync(position, cancellationToken);
    }

    // ──────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────

    private async Task<string> ExitSingleAsync(Position position, CancellationToken ct)
    {
        // Positive quantity → long position → exit with SELL
        // Negative quantity → short position → exit with BUY
        var transactionType = position.Quantity > 0
            ? TransactionType.Sell
            : TransactionType.Buy;

        var request = new PlaceOrderRequest
        {
            InstrumentToken = position.InstrumentToken,
            Quantity = Math.Abs(position.Quantity),
            TransactionType = transactionType,
            OrderType = OrderType.Market,
            Product = ParseProduct(position.Product),
            Tag = "EXIT"
        };

        var result = await _http.PlaceOrderV3Async(request, ct);
        return result.OrderIds.FirstOrDefault()!;
    }

    private static Product ParseProduct(string product) => product.ToUpperInvariant() switch
    {
        "D" => Product.Delivery,
        "MTF" => Product.MTF,
        "CO" => Product.CoverOrder,
        _ => Product.Intraday
    };
}
