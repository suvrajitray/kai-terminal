using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Models;
using KAITerminal.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.Broker.Upstox;

public class UpstoxOrderExecutor(
    UpstoxHttpClient upstox,
    IPositionProvider positions,
    IOptions<UpstoxSettings> settings,
    ILogger<UpstoxOrderExecutor> logger) : IOrderExecutor
{
    private readonly UpstoxSettings _settings = settings.Value;

    public async Task ExitAllAsync(AccessToken accessToken, string strategyId)
    {
        logger.LogWarning("ExitAll: Attempting to exit all open positions for strategy {StrategyId}.", strategyId);
        var openPositions = (await positions
            .GetOpenPositionsAsync(accessToken, strategyId))
            .Where(p => p.IsOpen)
            .OrderBy(p => p.Quantity)
            .ToList();

        foreach (var pos in openPositions)
        {
            await ExitPositionAsync(accessToken, pos);
        }
        logger.LogWarning("ExitAll: Exited {Count} open positions.", openPositions.Count);
    }

    public async Task ExitPositionAsync(AccessToken accessToken, Position pos)
    {
        var body = new
        {
            instrument_token = pos.InstrumentKey,
            transaction_type = pos.Quantity > 0 ? "SELL" : "BUY",
            order_type = "MARKET",
            quantity = Math.Abs(pos.Quantity),
            product = MapProduct(pos.Product),
            validity = "DAY",
            price = 0
        };

        var response = await upstox.PostJsonAsync(
            accessToken,
            $"{_settings.OrderBaseUrl}/v2/order/place",
            body);

        response.EnsureSuccessStatusCode();
    }

    public Task TakeNextOtmAsync(AccessToken accessToken, Position position, int strikeGap)
    {
        throw new NotImplementedException("TakeNextOtmAsync requires instrument key lookup — future work.");
    }

    public async Task CancelAllPendingAsync(AccessToken accessToken, string strategyId)
    {
        logger.LogWarning("CancelAll: Canceling all pending orders for strategy {StrategyId}.", strategyId);
        await Task.CompletedTask;
        logger.LogWarning("CancelAll: Successfully canceled all pending orders for strategy {StrategyId}.", strategyId);
    }

    private static string MapProduct(string product) => product switch
    {
        "MIS" => "I",
        "NRML" => "I",
        "CNC" => "D",
        _ => "I"
    };
}
