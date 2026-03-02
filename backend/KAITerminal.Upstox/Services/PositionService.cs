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
        OrderType orderType = OrderType.Market,
        Product product = Product.Intraday,
        CancellationToken cancellationToken = default)
    {
        var positions = await GetAllPositionsAsync(cancellationToken);
        var openPositions = positions.Where(p => p.IsOpen).ToList();

        if (openPositions.Count == 0)
            return [];

        var orderIds = new List<string>(openPositions.Count);

        // Place exit orders concurrently for all open positions.
        var tasks = openPositions.Select(p => ExitSingleAsync(p, orderType, product, cancellationToken));
        var results = await Task.WhenAll(tasks);

        orderIds.AddRange(results);
        return orderIds.AsReadOnly();
    }

    /// <inheritdoc />
    public async Task<string> ExitPositionAsync(
        string instrumentToken,
        OrderType orderType = OrderType.Market,
        Product product = Product.Intraday,
        CancellationToken cancellationToken = default)
    {
        var positions = await GetAllPositionsAsync(cancellationToken);
        var position = positions.FirstOrDefault(p =>
            string.Equals(p.InstrumentToken, instrumentToken, StringComparison.OrdinalIgnoreCase));

        if (position is null)
            throw new UpstoxException($"Position not found for instrument token: {instrumentToken}");

        if (!position.IsOpen)
            throw new UpstoxException($"Position for {instrumentToken} is already closed (quantity = 0).");

        return await ExitSingleAsync(position, orderType, product, cancellationToken);
    }

    // ──────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────

    private async Task<string> ExitSingleAsync(
        Position position, OrderType orderType, Product product, CancellationToken ct)
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
            OrderType = orderType,
            Product = product,
            Tag = "EXIT"
        };

        var result = await _http.PlaceOrderV2Async(request, ct);
        return result.OrderId;
    }
}
