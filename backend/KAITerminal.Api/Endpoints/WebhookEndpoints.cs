using System.Text.Json.Serialization;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

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
            HttpRequest request,
            BrokerCredentialService credentials,
            WebhookOrderProcessor processor,
            ILogger<ZerodhaOrderPostback> logger) =>
        {
            // Zerodha sends JSON via Go-http-client without Content-Type: application/json,
            // so we read the raw body and deserialize manually to avoid 415.
            request.EnableBuffering();
            var bodyBytes = await ReadBodyBytesAsync(request);
            var payload   = System.Text.Json.JsonSerializer.Deserialize<ZerodhaOrderPostback>(bodyBytes.AsSpan());
            if (payload is null)
            {
                logger.LogWarning("Zerodha webhook: failed to deserialize body — returning 400");
                return Results.BadRequest();
            }

            logger.LogInformation(
                "Zerodha webhook received — apiKey={ApiKey} orderId={OrderId} symbol={Symbol} status={Status}",
                apiKey, payload.OrderId, payload.TradingSymbol, payload.Status);

            // Look up the user by their unique Zerodha API key (cache-first)
            var cred = await credentials.FindByApiKeyAsync(BrokerNames.Zerodha, apiKey);

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

            // Verify Zerodha checksum: SHA256(order_id + order_timestamp + api_secret)
            if (!ZerodhaWebhookValidator.IsValid(payload.OrderId, payload.OrderTimestamp, cred.ApiSecret, payload.Checksum))
            {
                logger.LogWarning(
                    "Zerodha webhook: checksum mismatch — user={User} orderId={OrderId} receivedChecksum={Received}",
                    cred.Username, payload.OrderId, payload.Checksum);
                return Results.Unauthorized();
            }

            logger.LogInformation(
                "Zerodha webhook: checksum verified — user={User} orderId={OrderId}",
                cred.Username, payload.OrderId);

            if (!processor.IsActionableStatus(payload.Status))
            {
                logger.LogInformation(
                    "Zerodha webhook: ignoring intermediate status={Status} for orderId={OrderId}",
                    payload.Status, payload.OrderId);
                return Results.Ok();
            }

            var status = payload.Status!.ToLowerInvariant();
            logger.LogInformation(
                "Zerodha webhook: actionable order update — status={Status} user={User} orderId={OrderId} symbol={Symbol} message={Message}",
                status.ToUpperInvariant(), cred.Username, payload.OrderId, payload.TradingSymbol, payload.StatusMessage);

            await processor.ProcessAsync(
                cred.Username, "Zerodha",
                payload.OrderId ?? "", payload.Status ?? "", payload.StatusMessage ?? "", payload.TradingSymbol ?? "",
                payload.AveragePrice, payload.TransactionType ?? "", payload.FilledQuantity,
                refresh: status == "complete", logger);

            logger.LogInformation(
                "Zerodha webhook: done — orderId={OrderId} refresh={Refresh}",
                payload.OrderId, status == "complete");

            return Results.Ok();
        });

        // ── Upstox order postback ─────────────────────────────────────────────
        // Configure your Upstox app's postback URL as:
        //   https://{host}/api/webhooks/upstox/order/{your_upstox_api_key}
        // Each user has their own Upstox app — apiKey identifies the user.
        // Upstox does not send a verification signature — the apiKey in the URL path acts as the shared secret.
        app.MapPost("/api/webhooks/upstox/order/{apiKey}", async (
            string apiKey,
            HttpRequest request,
            BrokerCredentialService credentials,
            WebhookOrderProcessor processor,
            ILogger<UpstoxOrderPostback> logger) =>
        {
            logger.LogInformation(
                "Upstox webhook received — apiKey={ApiKey}",
                apiKey);

            request.EnableBuffering();
            var bodyBytes = await ReadBodyBytesAsync(request);

            var cred = await credentials.FindByApiKeyAsync(BrokerNames.Upstox, apiKey);
            if (cred is null)
            {
                logger.LogWarning(
                    "Upstox webhook: no credential found for apiKey={ApiKey} — returning 401",
                    apiKey);
                return Results.Unauthorized();
            }

            logger.LogInformation(
                "Upstox webhook: resolved apiKey={ApiKey} → user={User}",
                apiKey, cred.Username);

            var payload = System.Text.Json.JsonSerializer.Deserialize<UpstoxOrderPostback>(bodyBytes.AsSpan());
            if (payload is null)
            {
                logger.LogWarning("Upstox webhook: failed to deserialize body — returning 400");
                return Results.BadRequest();
            }

            // Verify the payload belongs to this user — guards against forged requests from
            // anyone who happens to know the webhook URL.
            if (!string.IsNullOrEmpty(cred.BrokerUserId) &&
                !string.Equals(payload.UserId, cred.BrokerUserId, StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning(
                    "Upstox webhook: userId mismatch — payload userId={PayloadUserId} expected={Expected} — returning 401",
                    payload.UserId, cred.BrokerUserId);
                return Results.Unauthorized();
            }

            logger.LogInformation(
                "Upstox webhook parsed — user={User} upstoxUserId={UpstoxUserId} orderId={OrderId} symbol={Symbol} status={Status}",
                cred.Username, payload.UserId, payload.OrderId, payload.TradingSymbol, payload.Status);

            var status = payload.Status?.ToLowerInvariant() ?? "";
            if (!processor.IsActionableStatus(payload.Status))
            {
                logger.LogInformation(
                    "Upstox webhook: ignoring intermediate status={Status} for orderId={OrderId}",
                    payload.Status, payload.OrderId);
                return Results.Ok();
            }

            logger.LogInformation(
                "Upstox webhook: actionable order update — status={Status} user={User} orderId={OrderId} symbol={Symbol} message={Message}",
                status.ToUpperInvariant(), cred.Username, payload.OrderId, payload.TradingSymbol, payload.StatusMessage);

            await processor.ProcessAsync(
                cred.Username, "Upstox",
                payload.OrderId       ?? "",
                payload.Status        ?? "",
                payload.StatusMessage ?? "",
                payload.TradingSymbol ?? "",
                payload.AveragePrice, payload.TransactionType ?? "", payload.FilledQuantity,
                refresh: status == "complete", logger);

            logger.LogInformation(
                "Upstox webhook: done — orderId={OrderId} refresh={Refresh}",
                payload.OrderId, status == "complete");

            return Results.Ok();
        });
    }

    // ── Body reading ──────────────────────────────────────────────────────────

    private static async Task<byte[]> ReadBodyBytesAsync(HttpRequest request)
    {
        using var ms = new MemoryStream();
        await request.Body.CopyToAsync(ms);
        request.Body.Position = 0; // rewind for potential further reads
        return ms.ToArray();
    }

}

// ── Payload models ────────────────────────────────────────────────────────────

public sealed class ZerodhaOrderPostback
{
    [JsonPropertyName("user_id")]         public string? UserId          { get; init; }
    [JsonPropertyName("order_id")]        public string? OrderId         { get; init; }
    [JsonPropertyName("order_timestamp")] public string? OrderTimestamp  { get; init; }
    [JsonPropertyName("tradingsymbol")]   public string? TradingSymbol   { get; init; }
    [JsonPropertyName("status")]          public string? Status          { get; init; }
    [JsonPropertyName("status_message")]  public string? StatusMessage   { get; init; }
    [JsonPropertyName("checksum")]        public string? Checksum        { get; init; }
    [JsonPropertyName("average_price")]    public decimal AveragePrice    { get; init; }
    [JsonPropertyName("transaction_type")] public string? TransactionType { get; init; }
    [JsonPropertyName("filled_quantity")]  public int     FilledQuantity  { get; init; }
}

public sealed class UpstoxOrderPostback
{
    [JsonPropertyName("order_id")]        public string? OrderId        { get; init; }
    [JsonPropertyName("userId")]          public string? UserId         { get; init; }
    [JsonPropertyName("trading_symbol")]  public string? TradingSymbol  { get; init; }
    [JsonPropertyName("status")]          public string? Status         { get; init; }
    [JsonPropertyName("status_message")]  public string? StatusMessage  { get; init; }
    [JsonPropertyName("average_price")]    public decimal AveragePrice    { get; init; }
    [JsonPropertyName("transaction_type")] public string? TransactionType { get; init; }
    [JsonPropertyName("filled_quantity")]  public int     FilledQuantity  { get; init; }
}
