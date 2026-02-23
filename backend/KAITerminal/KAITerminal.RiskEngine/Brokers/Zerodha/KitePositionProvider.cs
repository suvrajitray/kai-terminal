using System.Text.Json;
using KAITerminal.RiskEngine.Interfaces;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Brokers.Zerodha;

public class KitePositionProvider : IPositionProvider
{
  private readonly KiteHttpClient _kite;

  public KitePositionProvider(KiteHttpClient kite)
  {
    _kite = kite;
  }

  public async Task<List<Position>> GetOpenPositionsAsync(string strategyId)
  {
    var json = await _kite.GetStringAsync("/portfolio/positions");
    var doc = JsonDocument.Parse(json);

    var result = new List<Position>();

    foreach (var pos in doc.RootElement
                 .GetProperty("data")
                 .GetProperty("net")
                 .EnumerateArray())
    {
      // if (pos.GetProperty("quantity").GetInt32() == 0)
      //   continue;

      result.Add(new Position
      {
        Symbol = pos.GetProperty("tradingsymbol").GetString()!,
        AvgPrice = pos.GetProperty("average_price").GetDecimal(),
        Quantity = pos.GetProperty("quantity").GetInt32(),
        OptionType = ResolveOptionType(pos),
        IsOpen = pos.GetProperty("quantity").GetInt32() == 0 ? false : true
      });
    }

    return result;
  }

  public async Task<decimal> GetCurrentMtmAsync(string strategyId)
  {
    var json = await _kite.GetStringAsync("/portfolio/positions");
    var doc = JsonDocument.Parse(json);

    decimal mtm = 0;

    foreach (var pos in doc.RootElement
                 .GetProperty("data")
                 .GetProperty("net")
                 .EnumerateArray())
    {
      mtm += pos.GetProperty("pnl").GetDecimal();
    }

    return mtm;
  }

  private static string ResolveOptionType(JsonElement pos)
  {
    var symbol = pos.GetProperty("tradingsymbol").GetString()!;
    return symbol.EndsWith("CE") ? "CE" : "PE";
  }
}
