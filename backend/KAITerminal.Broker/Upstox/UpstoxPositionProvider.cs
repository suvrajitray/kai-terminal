using System.Text.Json;
using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Models;
using KAITerminal.Types;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Broker.Upstox;

public class UpstoxPositionProvider(
    UpstoxHttpClient upstox,
    ILogger<UpstoxPositionProvider> logger) : IPositionProvider
{
    public async Task<List<Position>> GetOpenPositionsAsync(AccessToken accessToken, string strategyId = "")
    {
        var json = await upstox.GetStringAsync(accessToken, "/v2/portfolio/short-term-positions");
        var doc = JsonDocument.Parse(json);
        var result = new List<Position>();

        foreach (var pos in doc.RootElement
            .GetProperty("data")
            .EnumerateArray())
        {
            var exchange = pos.GetProperty("exchange").GetString();
            if (exchange != "NFO") continue;

            var symbol = pos.GetProperty("trading_symbol").GetString()!;
            var quantity = pos.GetProperty("quantity").GetInt32();

            result.Add(new Position
            {
                Symbol = symbol,
                AveragePrice = pos.GetProperty("average_price").GetDecimal(),
                Quantity = quantity,
                OptionType = symbol.EndsWith("CE") ? "CE" : "PE",
                Product = pos.GetProperty("product").GetString()!,
                Ltp = pos.GetProperty("last_price").GetDecimal(),
                Pnl = pos.GetProperty("pnl").GetDecimal(),
                Exchange = exchange,
                InstrumentKey = pos.GetProperty("instrument_token").GetString()!,
                IsOpen = quantity != 0
            });
        }

        logger.LogInformation(
            "Fetched {Count} NFO positions from Upstox, Mtm: {Mtm}",
            result.Count,
            result.Sum(p => p.Pnl));

        return result;
    }

    public async Task<decimal> GetCurrentMtmAsync(AccessToken accessToken, string strategyId = "")
    {
        var positions = await GetOpenPositionsAsync(accessToken, strategyId);
        return positions.Sum(p => p.Pnl);
    }
}
