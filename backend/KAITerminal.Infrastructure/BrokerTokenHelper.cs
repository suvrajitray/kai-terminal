using System.Text;
using System.Text.Json;

namespace KAITerminal.Infrastructure;

public static class BrokerTokenHelper
{
    private static readonly TimeSpan IstOffset = TimeSpan.FromHours(5.5);

    /// <summary>
    /// Returns true when the token is present, non-stale (updated today after 7:30 AM IST),
    /// and — for Upstox — the JWT has not expired.
    /// </summary>
    public static bool IsTokenValid(string? token, DateTime updatedAt, string? brokerName = null)
    {
        if (string.IsNullOrEmpty(token) || token == "NA")
            return false;

        var todayIst  = (DateTime.UtcNow + IstOffset).Date;
        var cutoffUtc = todayIst + TimeSpan.FromHours(7.5) - IstOffset; // 7:30 AM IST → UTC
        if (updatedAt < cutoffUtc)
            return false;

        if (string.Equals(brokerName, "upstox", StringComparison.OrdinalIgnoreCase) && IsJwtExpired(token))
            return false;

        return true;
    }

    private static bool IsJwtExpired(string token)
    {
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 3) return true;
            var padded = parts[1].Replace('-', '+').Replace('_', '/');
            padded += (padded.Length % 4) switch { 2 => "==", 3 => "=", _ => "" };
            var json    = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
            var payload = JsonSerializer.Deserialize<JsonElement>(json);
            return !payload.TryGetProperty("exp", out var exp)
                || DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= exp.GetInt64();
        }
        catch { return true; }
    }
}
