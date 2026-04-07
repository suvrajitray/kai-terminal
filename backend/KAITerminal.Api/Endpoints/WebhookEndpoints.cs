using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Infrastructure.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Endpoints;

public static class WebhookEndpoints
{
    public static void MapWebhookEndpoints(this IEndpointRouteBuilder app)
    {
        // ── Zerodha order postback ────────────────────────────────────────────
        // Configure your Kite app's postback URL as:
        //   https://{host}/api/webhooks/zerodha/order?apiKey={your_zerodha_api_key}
        // Zerodha sends: POST with JSON body containing order details + SHA-256 checksum.
        app.MapPost("/api/webhooks/zerodha/order", async (
            [FromQuery] string apiKey,
            [FromBody]  ZerodhaOrderPostback payload,
            AppDbContext db,
            PositionStreamManager manager,
            ILogger<ZerodhaOrderPostback> logger) =>
        {
            // Look up the user by their unique Zerodha API key
            var cred = await db.BrokerCredentials
                .FirstOrDefaultAsync(x =>
                    x.BrokerName == BrokerNames.Zerodha &&
                    x.ApiKey     == apiKey);

            if (cred is null)
            {
                logger.LogWarning("Zerodha webhook: unknown apiKey={ApiKey}", apiKey);
                return Results.Unauthorized();
            }

            // Verify Zerodha checksum: SHA256(tradingsymbol + order_id + api_secret)
            var expected = ComputeZerodhaChecksum(
                payload.TradingSymbol, payload.OrderId, cred.ApiSecret);
            if (!string.Equals(expected, payload.Checksum, StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning(
                    "Zerodha webhook: checksum mismatch for user={User} order={OrderId}",
                    cred.Username, payload.OrderId);
                return Results.Unauthorized();
            }

            var status = payload.Status?.ToLowerInvariant() ?? "";
            if (status is not "complete" and not "rejected")
                return Results.Ok(); // ignore intermediate states

            logger.LogInformation(
                "Zerodha webhook: order {Status} — user={User} orderId={OrderId} symbol={Symbol}",
                status.ToUpperInvariant(), cred.Username, payload.OrderId, payload.TradingSymbol);

            await PushAndRefreshAsync(
                manager.GetAllForUser(cred.Username),
                payload.OrderId ?? "", payload.Status ?? "", payload.StatusMessage ?? "", payload.TradingSymbol ?? "",
                refresh: status == "complete");

            return Results.Ok();
        });

        // ── Upstox order postback ─────────────────────────────────────────────
        // Configure your Upstox app's postback URL as:
        //   https://{host}/api/webhooks/upstox/order
        // Upstox sends X-Api-Verify-Token header = SHA256(raw_body + api_secret).
        // Since Upstox is app-level (one postback URL for all users), we verify against
        // the shared ApiSecret stored in any Upstox BrokerCredential row.
        app.MapPost("/api/webhooks/upstox/order", async (
            HttpRequest request,
            AppDbContext db,
            PositionStreamManager manager,
            ILogger<UpstoxOrderPostback> logger) =>
        {
            // Read raw body for signature verification before deserialization
            request.EnableBuffering();
            var bodyBytes = await ReadBodyBytesAsync(request);

            // Fetch any stored Upstox ApiSecret (all users on the same app share one)
            var anyUpstoxCred = await db.BrokerCredentials
                .Where(x => x.BrokerName == BrokerNames.Upstox && x.ApiSecret != "")
                .FirstOrDefaultAsync();

            if (anyUpstoxCred is not null)
            {
                var signature = request.Headers["X-Api-Verify-Token"].FirstOrDefault() ?? "";
                if (!VerifyUpstoxSignature(bodyBytes, anyUpstoxCred.ApiSecret, signature))
                {
                    logger.LogWarning("Upstox webhook: invalid signature — request rejected");
                    return Results.Unauthorized();
                }
            }
            else
            {
                logger.LogWarning("Upstox webhook: no ApiSecret stored — skipping signature check");
            }

            var payload = await System.Text.Json.JsonSerializer.DeserializeAsync<UpstoxOrderPostback>(
                new MemoryStream(bodyBytes));
            if (payload is null) return Results.BadRequest();

            var status = payload.Status?.ToLowerInvariant() ?? "";
            if (status is not "complete" and not "rejected")
                return Results.Ok();

            logger.LogInformation(
                "Upstox webhook: order {Status} — userId={UpstoxUserId} orderId={OrderId} symbol={Symbol}",
                status.ToUpperInvariant(), payload.UserId, payload.OrderId, payload.TradingSymbol);

            IEnumerable<KAITerminal.Api.Hubs.PositionStreamCoordinator> targets;

            if (!string.IsNullOrEmpty(payload.UserId))
            {
                // Resolve the specific user by their stored Upstox user_id.
                var username = await db.BrokerCredentials
                    .Where(x => x.BrokerName == BrokerNames.Upstox && x.BrokerUserId == payload.UserId)
                    .Select(x => x.Username)
                    .FirstOrDefaultAsync();

                targets = username is not null
                    ? manager.GetAllForUser(username)
                    : manager.GetAllForBroker(BrokerNames.Upstox); // fallback: broadcast
            }
            else
            {
                targets = manager.GetAllForBroker(BrokerNames.Upstox);
            }

            await PushAndRefreshAsync(
                targets,
                payload.OrderId       ?? "",
                payload.Status        ?? "",
                payload.StatusMessage ?? "",
                payload.TradingSymbol ?? "",
                refresh: status == "complete");

            return Results.Ok();
        });
    }

    // ── Shared helper ─────────────────────────────────────────────────────────

    private static async Task PushAndRefreshAsync(
        IEnumerable<KAITerminal.Api.Hubs.PositionStreamCoordinator> coordinators,
        string orderId, string status, string statusMessage, string tradingSymbol,
        bool refresh)
    {
        var tasks = coordinators.Select(async coord =>
        {
            await coord.PushOrderUpdateAsync(orderId, status, statusMessage, tradingSymbol);
            if (refresh)
                await coord.TriggerRefreshAsync();
        });
        await Task.WhenAll(tasks);
    }

    // ── Body reading ──────────────────────────────────────────────────────────

    private static async Task<byte[]> ReadBodyBytesAsync(HttpRequest request)
    {
        using var ms = new MemoryStream();
        await request.Body.CopyToAsync(ms);
        request.Body.Position = 0; // rewind for potential further reads
        return ms.ToArray();
    }

    // ── Upstox HMAC verification ──────────────────────────────────────────────

    /// <summary>
    /// Upstox postback signature: SHA256(raw_body_string + api_secret), hex-encoded.
    /// Ref: Upstox developer docs → Postback → Verification.
    /// </summary>
    private static bool VerifyUpstoxSignature(byte[] bodyBytes, string apiSecret, string signature)
    {
        if (string.IsNullOrEmpty(signature)) return false;
        var body     = Encoding.UTF8.GetString(bodyBytes);
        var raw      = body + apiSecret;
        var hash     = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        var expected = Convert.ToHexStringLower(hash);
        return string.Equals(expected, signature, StringComparison.OrdinalIgnoreCase);
    }

    // ── Zerodha checksum ──────────────────────────────────────────────────────

    private static string ComputeZerodhaChecksum(
        string? tradingSymbol, string? orderId, string apiSecret)
    {
        var raw   = $"{tradingSymbol}{orderId}{apiSecret}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexStringLower(bytes);
    }

}

// ── Payload models ────────────────────────────────────────────────────────────

public sealed class ZerodhaOrderPostback
{
    [JsonPropertyName("user_id")]      public string? UserId        { get; init; }
    [JsonPropertyName("order_id")]     public string? OrderId       { get; init; }
    [JsonPropertyName("tradingsymbol")]public string? TradingSymbol { get; init; }
    [JsonPropertyName("status")]       public string? Status        { get; init; }
    [JsonPropertyName("status_message")]public string? StatusMessage{ get; init; }
    [JsonPropertyName("checksum")]     public string? Checksum      { get; init; }
}

public sealed class UpstoxOrderPostback
{
    [JsonPropertyName("order_id")]       public string? OrderId       { get; init; }
    [JsonPropertyName("user_id")]        public string? UserId        { get; init; }
    [JsonPropertyName("trading_symbol")] public string? TradingSymbol { get; init; }
    [JsonPropertyName("status")]         public string? Status        { get; init; }
    [JsonPropertyName("status_message")] public string? StatusMessage { get; init; }
}
