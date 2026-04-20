using System.Text;
using System.Text.Json;

namespace KAITerminal.Infrastructure;

public enum TokenValidationResult { Valid, Missing, Stale, JwtExpired }

public static class BrokerTokenHelper
{
    private static readonly TimeSpan IstOffset = TimeSpan.FromHours(5.5);

    /// <summary>
    /// Returns the specific reason a token is invalid, or <see cref="TokenValidationResult.Valid"/>.
    /// </summary>
    public static TokenValidationResult Validate(string? token, DateTime updatedAt, string? brokerName = null)
    {
        if (string.IsNullOrEmpty(token) || token == "NA")
            return TokenValidationResult.Missing;

        var todayIst  = (DateTime.UtcNow + IstOffset).Date;
        var cutoffUtc = todayIst + TimeSpan.FromHours(7.5) - IstOffset; // 7:30 AM IST → UTC
        if (updatedAt < cutoffUtc)
            return TokenValidationResult.Stale;

        if (string.Equals(brokerName, "upstox", StringComparison.OrdinalIgnoreCase) && IsJwtExpired(token))
            return TokenValidationResult.JwtExpired;

        return TokenValidationResult.Valid;
    }

    /// <summary>Convenience wrapper — returns true only when <see cref="Validate"/> is <see cref="TokenValidationResult.Valid"/>.</summary>
    public static bool IsTokenValid(string? token, DateTime updatedAt, string? brokerName = null)
        => Validate(token, updatedAt, brokerName) == TokenValidationResult.Valid;

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
