using System.Text.Json;
using System.Text.RegularExpressions;
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

    public async Task TakeNextOtmAsync(AccessToken accessToken, Position position, int strikeGap)
    {
        logger.LogInformation(
            "TakeNextOtm: Re-entering next OTM for {Symbol}, gap={Gap}.",
            position.Symbol, strikeGap);

        var (underlying, year, month, day, currentStrike, optionType) = ParseNfoSymbol(position.Symbol);
        int newStrike = optionType == "CE" ? currentStrike + strikeGap : currentStrike - strikeGap;

        var underlyingKey = ToUnderlyingKey(underlying);
        if (underlyingKey is null)
        {
            logger.LogWarning(
                "TakeNextOtm: Unknown underlying '{Underlying}' in symbol {Symbol}. Skipping.",
                underlying, position.Symbol);
            return;
        }

        var instrumentKey = await FindOptionInstrumentKeyAsync(
            accessToken, underlyingKey, newStrike, optionType, year, month, day);

        if (instrumentKey is null)
        {
            logger.LogWarning(
                "TakeNextOtm: Instrument not found for {Underlying} {Strike} {Type} {Year}/{Month}. Skipping.",
                underlying, newStrike, optionType, year, month);
            return;
        }

        var body = new
        {
            instrument_token = instrumentKey,
            transaction_type = position.Quantity > 0 ? "BUY" : "SELL",
            order_type = "MARKET",
            quantity = Math.Abs(position.Quantity),
            product = MapProduct(position.Product),
            validity = "DAY",
            price = 0
        };

        var response = await upstox.PostJsonAsync(
            accessToken,
            $"{_settings.OrderBaseUrl}/v2/order/place",
            body);

        response.EnsureSuccessStatusCode();
        logger.LogInformation(
            "TakeNextOtm: Re-entry order placed for {Underlying} {Strike} {Type}.",
            underlying, newStrike, optionType);
    }

    public async Task CancelAllPendingAsync(AccessToken accessToken, string strategyId)
    {
        logger.LogWarning("CancelAll: Fetching order book for strategy {StrategyId}.", strategyId);

        var json = await upstox.GetStringAsync(accessToken, "/v2/order/retrieve-all");
        var doc = JsonDocument.Parse(json);

        var pendingOrderIds = doc.RootElement
            .GetProperty("data")
            .EnumerateArray()
            .Where(o =>
            {
                var status = o.GetProperty("status").GetString() ?? "";
                return status is "open" or "trigger pending";
            })
            .Select(o => o.GetProperty("order_id").GetString()!)
            .ToList();

        logger.LogWarning("CancelAll: Found {Count} open/pending orders.", pendingOrderIds.Count);

        foreach (var orderId in pendingOrderIds)
        {
            var response = await upstox.DeleteAsync(
                accessToken,
                $"{_settings.OrderBaseUrl}/v2/order/cancel?order_id={orderId}");
            response.EnsureSuccessStatusCode();
            logger.LogInformation("CancelAll: Canceled order {OrderId}.", orderId);
        }

        logger.LogWarning(
            "CancelAll: Canceled {Count} pending orders for strategy {StrategyId}.",
            pendingOrderIds.Count, strategyId);
    }

    private async Task<string?> FindOptionInstrumentKeyAsync(
        AccessToken accessToken,
        string underlyingKey,
        int strike,
        string optionType,
        int year,
        int month,
        int? day)
    {
        var url = $"/v2/option/contract?instrument_key={Uri.EscapeDataString(underlyingKey)}";
        var json = await upstox.GetStringAsync(accessToken, url);
        var doc = JsonDocument.Parse(json);

        foreach (var contract in doc.RootElement.GetProperty("data").EnumerateArray())
        {
            if (contract.GetProperty("instrument_type").GetString() != optionType) continue;

            var contractStrike = (int)Math.Round(contract.GetProperty("strike_price").GetDecimal());
            if (contractStrike != strike) continue;

            var expiry = DateTime.Parse(contract.GetProperty("expiry").GetString()!);
            if (expiry.Year != year || expiry.Month != month) continue;
            if (day.HasValue && expiry.Day != day.Value) continue;

            return contract.GetProperty("instrument_key").GetString();
        }

        return null;
    }

    // Parses compact NFO option symbols used in Upstox position data.
    // Monthly format:  NIFTY24DEC19650CE   → year=2024, month=12, day=null
    // Weekly format:   NIFTY24D1219650CE   → year=2024, month=12, day=12
    //   Weekly month codes: 1-9 = Jan-Sep, O = Oct, N = Nov, D = Dec
    private static (string underlying, int year, int month, int? day, int strike, string optionType)
        ParseNfoSymbol(string symbol)
    {
        var monthly = Regex.Match(
            symbol,
            @"^([A-Z]+)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+)(CE|PE)$");
        if (monthly.Success)
        {
            return (
                monthly.Groups[1].Value,
                2000 + int.Parse(monthly.Groups[2].Value),
                MonthAbbrevToNumber(monthly.Groups[3].Value),
                null,
                int.Parse(monthly.Groups[4].Value),
                monthly.Groups[5].Value
            );
        }

        var weekly = Regex.Match(symbol, @"^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$");
        if (weekly.Success)
        {
            return (
                weekly.Groups[1].Value,
                2000 + int.Parse(weekly.Groups[2].Value),
                WeeklyMonthCodeToNumber(weekly.Groups[3].Value),
                int.Parse(weekly.Groups[4].Value),
                int.Parse(weekly.Groups[5].Value),
                weekly.Groups[6].Value
            );
        }

        throw new ArgumentException($"Cannot parse NFO option symbol: {symbol}");
    }

    private static int MonthAbbrevToNumber(string abbrev) => abbrev switch
    {
        "JAN" => 1, "FEB" => 2,  "MAR" => 3,  "APR" => 4,
        "MAY" => 5, "JUN" => 6,  "JUL" => 7,  "AUG" => 8,
        "SEP" => 9, "OCT" => 10, "NOV" => 11, "DEC" => 12,
        _ => throw new ArgumentException($"Unknown month abbreviation: {abbrev}")
    };

    private static int WeeklyMonthCodeToNumber(string code) => code switch
    {
        "1" => 1, "2" => 2, "3" => 3, "4" => 4, "5" => 5,
        "6" => 6, "7" => 7, "8" => 8, "9" => 9,
        "O" => 10, "N" => 11, "D" => 12,
        _ => throw new ArgumentException($"Unknown weekly month code: {code}")
    };

    private static string? ToUnderlyingKey(string underlying) => underlying switch
    {
        "NIFTY"      => "NSE_INDEX|Nifty 50",
        "BANKNIFTY"  => "NSE_INDEX|Nifty Bank",
        "FINNIFTY"   => "NSE_INDEX|Nifty Fin Service",
        "MIDCPNIFTY" => "NSE_INDEX|NIFTY MID SELECT",
        "SENSEX"     => "BSE_INDEX|SENSEX",
        "BANKEX"     => "BSE_INDEX|BANKEX",
        _ => null
    };

    private static string MapProduct(string product) => product switch
    {
        "MIS" => "I",
        "NRML" => "I",
        "CNC" => "D",
        _ => "I"
    };
}
