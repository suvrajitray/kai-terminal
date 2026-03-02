using System.Globalization;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Services;

/// <summary>
/// Monitors per-strike CE/PE stop losses and handles exit + OTM1 re-entry.
/// Call <see cref="MonitorAsync"/> inside a <c>UpstoxTokenContext.Use(token)</c> scope.
/// </summary>
public sealed class StrikeMonitor
{
    private static readonly Dictionary<string, string> UnderlyingKeyMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["NIFTY"]      = "NSE_INDEX|Nifty 50",
        ["BANKNIFTY"]  = "NSE_INDEX|Nifty Bank",
        ["FINNIFTY"]   = "NSE_INDEX|Nifty Fin Service",
        ["MIDCPNIFTY"] = "NSE_INDEX|NIFTY MID SELECT",
        ["SENSEX"]     = "BSE_INDEX|SENSEX",
        ["BANKEX"]     = "BSE_INDEX|BANKEX",
    };

    private readonly UpstoxClient _upstox;
    private readonly IRiskRepository _repo;
    private readonly RiskEngineConfig _cfg;
    private readonly ILogger<StrikeMonitor> _logger;

    public StrikeMonitor(
        UpstoxClient upstox,
        IRiskRepository repo,
        IOptions<RiskEngineConfig> cfg,
        ILogger<StrikeMonitor> logger)
    {
        _upstox = upstox;
        _repo = repo;
        _cfg = cfg.Value;
        _logger = logger;
    }

    public async Task MonitorAsync(string userId, CancellationToken ct = default)
    {
        var state = _repo.GetOrCreate(userId);

        if (state.IsSquaredOff)
        {
            _logger.LogDebug("Strike check skipped for userId={UserId}: already squared off", userId);
            return;
        }

        IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> positions;
        try
        {
            positions = await _upstox.GetAllPositionsAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Strike check: failed to fetch positions for userId={UserId}", userId);
            return;
        }

        foreach (var pos in positions)
        {
            if (!pos.IsOpen) continue;

            var symbol = pos.TradingSymbol;
            if (symbol.Length < 3) continue;

            var suffix = symbol[^2..].ToUpperInvariant();
            if (suffix is not ("CE" or "PE")) continue;

            // Only NFO options (short positions: negative quantity)
            if (pos.Quantity >= 0) continue;

            var optionType = suffix == "CE" ? OptionType.CE : OptionType.PE;
            double slThreshold = optionType == OptionType.CE ? _cfg.CeStopLossPercent : _cfg.PeStopLossPercent;

            // For short options: loss = LTP rose above avg entry price
            // lossPercent = (LastPrice - AveragePrice) / AveragePrice
            if (pos.AveragePrice == 0) continue;
            double lossPercent = (double)((pos.LastPrice - pos.AveragePrice) / pos.AveragePrice);

            if (lossPercent <= slThreshold) continue;

            _logger.LogWarning(
                "Strike SL triggered: {Symbol} lossPercent={LossPct:P1} — exiting",
                symbol, lossPercent);

            // ── Exit position ────────────────────────────────────────────────
            try
            {
                await _upstox.ExitPositionAsync(pos.InstrumentToken, cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to exit position {Symbol} for userId={UserId}", symbol, userId);
                continue;
            }

            // ── Re-entry ─────────────────────────────────────────────────────
            if (!state.ReentryCounts.TryGetValue(symbol, out int reentries))
                reentries = 0;

            if (reentries >= _cfg.MaxReentries)
            {
                _logger.LogInformation(
                    "Max re-entries ({Max}) reached for {Symbol} — no re-entry",
                    _cfg.MaxReentries, symbol);
                continue;
            }

            if (!TryParseSymbol(symbol, optionType, out string underlying, out string expiryDate))
            {
                _logger.LogWarning("Could not parse trading symbol for re-entry: {Symbol}", symbol);
                continue;
            }

            if (!UnderlyingKeyMap.TryGetValue(underlying, out string? underlyingKey))
            {
                _logger.LogWarning("No underlying key mapping for {Underlying}", underlying);
                continue;
            }

            int quantity = Math.Abs(pos.Quantity);
            reentries++;
            state.ReentryCounts[symbol] = reentries;
            _repo.Update(userId, state);

            _logger.LogInformation(
                "Re-entering OTM1 for {Underlying} {OptionType} expiry={Expiry} qty={Qty} (reentry {N}/{Max})",
                underlying, optionType, expiryDate, quantity, reentries, _cfg.MaxReentries);

            try
            {
                await _upstox.PlaceOrderByStrikeV3Async(new PlaceOrderByStrikeRequest
                {
                    UnderlyingKey    = underlyingKey,
                    ExpiryDate       = expiryDate,
                    OptionType       = optionType,
                    StrikeType       = StrikeType.OTM1,
                    Quantity         = quantity,
                    TransactionType  = TransactionType.Sell,
                    Slice            = true,
                }, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Re-entry order failed for {Symbol}, reentry {N}", symbol, reentries);
            }
        }
    }

    /// <summary>
    /// Parses an NFO trading symbol of the form <c>NIFTY25JAN2323000CE</c>
    /// into underlying name and expiry date (YYYY-MM-DD).
    /// </summary>
    private static bool TryParseSymbol(
        string symbol,
        OptionType optionType,
        out string underlying,
        out string expiryDate)
    {
        underlying = "";
        expiryDate = "";

        // Strip the trailing CE/PE (2 chars)
        var body = symbol[..^2];

        // Find which underlying prefix matches (longest first to avoid ambiguity)
        string? matchedUnderlying = null;
        foreach (var key in UnderlyingKeyMap.Keys.OrderByDescending(k => k.Length))
        {
            if (body.StartsWith(key, StringComparison.OrdinalIgnoreCase))
            {
                matchedUnderlying = key;
                break;
            }
        }

        if (matchedUnderlying is null) return false;

        var rest = body[matchedUnderlying.Length..]; // e.g. "25JAN2323000"

        // Monthly expiry format: DDMMMYY = 7 chars  e.g. "25JAN23"
        // Weekly expiry format:  YYMDD   = 5 chars  e.g. "2501L" (Upstox proprietary)
        // We handle monthly (most common for index options)
        if (rest.Length < 7) return false;

        var expiryStr = rest[..7];
        var strikeStr = rest[7..];

        if (!int.TryParse(strikeStr, out _)) return false;

        if (!DateTime.TryParseExact(expiryStr, "ddMMMyy",
                CultureInfo.InvariantCulture, DateTimeStyles.None, out var expiry))
            return false;

        underlying = matchedUnderlying.ToUpperInvariant();
        expiryDate = expiry.ToString("yyyy-MM-dd");
        return true;
    }
}
