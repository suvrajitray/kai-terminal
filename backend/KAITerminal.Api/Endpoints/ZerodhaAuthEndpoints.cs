using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Zerodha;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Endpoints;

internal static class ZerodhaAuthEndpoints
{
    internal static void Map(RouteGroupBuilder group, ILogger logger)
    {
        group.MapGet("/auth-url", ([FromQuery] string apiKey) =>
        {
            if (string.IsNullOrWhiteSpace(apiKey))
                return Results.BadRequest(new { error = "apiKey is required." });
            return Results.Ok(new { loginUrl = $"https://kite.zerodha.com/connect/login?api_key={apiKey}&v=3" });
        });

        group.MapPost("/access-token", async (
            [FromBody] ZerodhaTokenRequest request,
            ZerodhaClient zerodha,
            BrokerCredentialService credentials,
            HttpContext ctx,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.ApiKey)
                || string.IsNullOrWhiteSpace(request.ApiSecret)
                || string.IsNullOrWhiteSpace(request.RequestToken))
            {
                return Results.BadRequest(new
                {
                    error = "apiKey, apiSecret, and requestToken are required."
                });
            }

            var (accessToken, brokerUserId) = await zerodha.Auth.GenerateTokenWithUserIdAsync(
                request.ApiKey, request.ApiSecret, request.RequestToken, ct: ct);

            var userEmail = ctx.User?.GetEmail() ?? "";

            if (!string.IsNullOrEmpty(userEmail))
            {
                await credentials.UpsertAsync(userEmail, new SaveBrokerCredentialRequest(
                    BrokerName:  BrokerNames.Zerodha,
                    ApiKey:      request.ApiKey,
                    ApiSecret:   request.ApiSecret,
                    AccessToken: accessToken));
                if (!string.IsNullOrEmpty(brokerUserId))
                    await credentials.UpdateBrokerUserIdAsync(userEmail, BrokerNames.Zerodha, brokerUserId);
            }

            logger.LogInformation(
                "Zerodha access token exchanged and persisted — {User} zerodhaUserId={UserId}", userEmail, brokerUserId);

            return Results.Ok(new { accessToken });
        });
    }

    private sealed record ZerodhaTokenRequest(
        string ApiKey,
        string ApiSecret,
        string RequestToken);
}
