using System.Text.RegularExpressions;

namespace KAITerminal.Broker.Zerodha;

public static class OtmStrikeCalculator
{
  public static string GetNextStrike(string symbol, int gap)
  {
    var match = Regex.Match(symbol, @"(\d+)(CE|PE)$");
    if (!match.Success) return symbol;

    var strike = int.Parse(match.Groups[1].Value);
    var type = match.Groups[2].Value;

    var nextStrike = type == "CE"
        ? strike + gap
        : strike - gap;

    return symbol.Replace(strike.ToString(), nextStrike.ToString());
  }
}
