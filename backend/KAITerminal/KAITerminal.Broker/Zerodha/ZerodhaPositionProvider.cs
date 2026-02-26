using System.Text.Json;
using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Models;
using KAITerminal.Types;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Broker.Zerodha;

public class ZerodhaPositionProvider(
  KiteConnectHttpClient kiteConnect,
  ILogger<ZerodhaPositionProvider> logger) : IPositionProvider
{
  public async Task<List<Position>> GetOpenPositionsAsync(AccessToken accessToken, string strategyId)
  {
    var json = await kiteConnect.GetStringAsync(accessToken, "/portfolio/positions");
    var doc = JsonDocument.Parse(json);
    var result = new List<Position>();

    foreach (var pos in doc.RootElement
                 .GetProperty("data")
                 .GetProperty("net")
                 .EnumerateArray())
    {

      result.Add(new Position
      {
        Symbol = pos.GetProperty("tradingsymbol").GetString()!,
        AveragePrice = pos.GetProperty("average_price").GetDecimal(),
        Quantity = pos.GetProperty("quantity").GetInt32(),
        OptionType = pos.GetProperty("tradingsymbol")
                        .GetString()!.EndsWith("CE") ? "CE" : "PE",
        Product = pos.GetProperty("product").GetString()!,
        Ltp = pos.GetProperty("last_price").GetDecimal(),
        Pnl = pos.GetProperty("pnl").GetDecimal(),
        Exchange = pos.GetProperty("exchange").GetString(),
        Segment = pos.GetProperty("segment").GetString(),
        IsOpen = pos.GetProperty("quantity").GetInt32() == 0 ? false : true,
        InstrumentToken = pos.GetProperty("instrument_token").GetInt64()
      });
    }
    var fnoPositions = result.Where(p => p.Segment == "FO").ToList();
    logger.LogInformation(
      "Fetched {Count} positions from Zerodha, Mtm: {Mtm}",
      fnoPositions.Count,
      fnoPositions.Sum(p => p.Pnl));

    return fnoPositions;
  }

  public async Task<decimal> GetCurrentMtmAsync(AccessToken accessToken, string strategyId)
  {
    var positions = await GetOpenPositionsAsync(accessToken, strategyId);
    return positions.Sum(p => p.Pnl);
  }
}
