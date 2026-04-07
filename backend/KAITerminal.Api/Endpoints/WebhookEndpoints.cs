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
            logger.LogInformation(
                "Zerodha webhook received — apiKey={ApiKey} orderId={OrderId} symbol={Symbol} status={Status}",
                apiKey, payload.OrderId, payload.TradingSymbol, payload.Status);

            // Look up the user by their unique Zerodha API key
            var cred = await db.BrokerCredentials
                .FirstOrDefaultAsync(x =>
                    x.BrokerName == BrokerNames.Zerodha &&
                    x.ApiKey     == apiKey);

            if (cred is null)
            {
                logger.LogWarning(
                    "Zerodha webhook: no credential found for apiKey={ApiKey} — returning 401",
                    apiKey);
                return Results.Unauthorized();
            }

            logger.LogInformation(
                "Zerodha webhook: resolved apiKey={ApiKey} → user={User}",
                apiKey, cred.Username);

            // Verify Zerodha checksum: SHA256(tradingsymbol + order_id + api_secret)
            var expected = ComputeZerodhaChecksum(
                payload.TradingSymbol, payload.OrderId, cred.ApiSecret);
            if (!string.Equals(expected, payload.Checksum, StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning(
                    "Zerodha webhook: checksum mismatch — user={User} orderId={OrderId} receivedChecksum={Received} expectedChecksum={Expected}",
                    cred.Username, payload.OrderId, payload.Checksum, expected);
                return Results.Unauthorized();
            }

            logger.LogInformation(
                "Zerodha webhook: checksum verified — user={User} orderId={OrderId}",
                cred.Username, payload.OrderId);

            var status = payload.Status?.ToLowerInvariant() ?? "";
            if (status is not "complete" and not "rejected")
            {
                logger.LogInformation(
                    "Zerodha webhook: ignoring intermediate status={Status} for orderId={OrderId}",
                    payload.Status, payload.OrderId);
                return Results.Ok();
            }

            logger.LogInformation(
                "Zerodha webhook: actionable order update — status={Status} user={User} orderId={OrderId} symbol={Symbol} message={Message}",
                status.ToUpperInvariant(), cred.Username, payload.OrderId, payload.TradingSymbol, payload.StatusMessage);

            var coordinators = manager.GetAllForUser(cred.Username).ToList();
            logger.LogInformation(
                "Zerodha webhook: pushing to {Count} active connection(s) for user={User}",
                coordinators.Count, cred.Username);

            await PushAndRefreshAsync(
                coordinators,
                payload.OrderId ?? "", payload.Status ?? "", payload.StatusMessage ?? "", payload.TradingSymbol ?? "",
                refresh: status == "complete",
                logger: logger,
                broker: "Zerodha");

            logger.LogInformation(
                "Zerodha webhook: done — orderId={OrderId} refresh={Refresh}",
                payload.OrderId, status == "complete");

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
            logger.LogInformation("Upstox webhook received — reading body for signature verification");

            // Read raw body for signature verification before deserialization
            request.EnableBuffering();
            var bodyBytes = await ReadBodyBytesAsync(request);

            logger.LogInformation(
                "Upstox webhook: body size={Bytes}B X-Api-Verify-Token={HasToken}",
                bodyBytes.Length,
                request.Headers.ContainsKey("X-Api-Verify-Token") ? "present" : "absent");

            // Fetch any stored Upstox ApiSecret (all users on the same app share one)
            var anyUpstoxCred = await db.BrokerCredentials
                .Where(x => x.BrokerName == BrokerNames.Upstox && x.ApiSecret != "")
                .FirstOrDefaultAsync();

            if (anyUpstoxCred is not null)
            {
                var signature = request.Headers["X-Api-Verify-Token"].FirstOrDefault() ?? "";
                if (!VerifyUpstoxSignature(bodyBytes, anyUpstoxCred.ApiSecret, signature))
                {
                    logger.LogWarning(
                        "Upstox webhook: signature verification failed — receivedToken={Token} — returning 401",
                        string.IsNullOrEmpty(signature) ? "<empty>" : signature[..Math.Min(8, signature.Length)] + "…");
                    return Results.Unauthorized();
                }
                logger.LogInformation("Upstox webhook: signature verified");
            }
            else
            {
                logger.LogWarning("Upstox webhook: no Upstox ApiSecret in DB — skipping signature check (configure credentials first)");
            }

            var payload = await System.Text.Json.JsonSerializer.DeserializeAsync<UpstoxOrderPostback>(
                new MemoryStream(bodyBytes));
            if (payload is null)
            {
                logger.LogWarning("Upstox webhook: failed to deserialize body — returning 400");
                return Results.BadRequest();
            }

            logger.LogInformation(
                "Upstox webhook parsed — upstoxUserId={UpstoxUserId} orderId={OrderId} symbol={Symbol} status={Status}",
                payload.UserId, payload.OrderId, payload.TradingSymbol, payload.Status);

            var status = payload.Status?.ToLowerInvariant() ?? "";
            if (status is not "complete" and not "rejected")
            {
                logger.LogInformation(
                    "Upstox webhook: ignoring intermediate status={Status} for orderId={OrderId}",
                    payload.Status, payload.OrderId);
                return Results.Ok();
            }

            logger.LogInformation(
                "Upstox webhook: actionable order update — status={Status} upstoxUserId={UpstoxUserId} orderId={OrderId} symbol={Symbol} message={Message}",
                status.ToUpperInvariant(), payload.UserId, payload.OrderId, payload.TradingSymbol, payload.StatusMessage);

            List<KAITerminal.Api.Hubs.PositionStreamCoordinator> targets;

            if (!string.IsNullOrEmpty(payload.UserId))
            {
                // Resolve the specific user by their stored Upstox user_id.
                var username = await db.BrokerCredentials
                    .Where(x => x.BrokerName == BrokerNames.Upstox && x.BrokerUserId == payload.UserId)
                    .Select(x => x.Username)
                    .FirstOrDefaultAsync();

                if (username is not null)
                {
                    logger.LogInformation(
                        "Upstox webhook: resolved upstoxUserId={UpstoxUserId} → user={User}",
                        payload.UserId, username);
                    targets = manager.GetAllForUser(username).ToList();
                }
                else
                {
                    logger.LogWarning(
                        "Upstox webhook: no user found for upstoxUserId={UpstoxUserId} — broadcasting to all Upstox connections (user may need to re-authenticate to populate BrokerUserId)",
                        payload.UserId);
                    targets = manager.GetAllForBroker(BrokerNames.Upstox).ToList();
                }
            }
            else
            {
                logger.LogWarning(
                    "Upstox webhook: payload has no user_id — broadcasting to all Upstox connections");
                targets = manager.GetAllForBroker(BrokerNames.Upstox).ToList();
            }

            logger.LogInformation(
                "Upstox webhook: pushing to {Count} active connection(s)",
                targets.Count);

            await PushAndRefreshAsync(
                targets,
                payload.OrderId       ?? "",
                payload.Status        ?? "",
                payload.StatusMessage ?? "",
                payload.TradingSymbol ?? "",
                refresh: status == "complete",
                logger: logger,
                broker: "Upstox");

            logger.LogInformation(
                "Upstox webhook: done — orderId={OrderId} refresh={Refresh}",
                payload.OrderId, status == "complete");

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

    private static async Task PushAndRefreshAsync(
        IEnumerable<KAITerminal.Api.Hubs.PositionStreamCoordinator> coordinators,
        string orderId, string status, string statusMessage, string tradingSymbol,
        bool refresh,
        ILogger logger,
        string broker)
    {
        var list  = coordinators.ToList();
        var tasks = list.Select(async coord =>
        {
            logger.LogInformation(
                "{Broker} webhook: sending ReceiveOrderUpdate to connection={Connection} — orderId={OrderId} status={Status}",
                broker, coord.Username, orderId, status);
            await coord.PushOrderUpdateAsync(orderId, status, statusMessage, tradingSymbol);
            if (refresh)
            {
                logger.LogInformation(
                    "{Broker} webhook: triggering position refresh for connection={Connection}",
                    broker, coord.Username);
                await coord.TriggerRefreshAsync();
            }
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
