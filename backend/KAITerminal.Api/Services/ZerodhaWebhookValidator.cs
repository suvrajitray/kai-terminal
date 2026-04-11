using System.Security.Cryptography;
using System.Text;

namespace KAITerminal.Api.Services;

/// <summary>
/// Verifies Zerodha order postback checksums.
/// Zerodha signs each postback as SHA-256(order_id + order_timestamp + api_secret).
/// </summary>
internal static class ZerodhaWebhookValidator
{
    /// <summary>
    /// Returns <c>true</c> when the checksum in <paramref name="receivedChecksum"/> matches
    /// the expected signature computed from the order's fields and the user's API secret.
    /// </summary>
    public static bool IsValid(
        string? orderId, string? orderTimestamp,
        string apiSecret, string? receivedChecksum)
    {
        var raw      = $"{orderId}{orderTimestamp}{apiSecret}";
        var expected = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
        return string.Equals(expected, receivedChecksum, StringComparison.OrdinalIgnoreCase);
    }
}
