using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Upstox;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Endpoints;

internal static class UpstoxAuthEndpoints
{
    internal static void Map(RouteGroupBuilder group, ILogger logger)
    {
        group.MapPost("/access-token", async (
            [FromBody] UpstoxTokenRequest request,
            UpstoxClient upstox,
            BrokerCredentialService credentials,
            ClaimsPrincipal user) =>
        {
            var (accessToken, brokerUserId) = await upstox.Auth.GenerateTokenWithUserIdAsync(
                request.ApiKey, request.ApiSecret, request.Code, request.RedirectUri);
            var username = user.GetEmail() ?? "";
            if (!string.IsNullOrEmpty(username) && !string.IsNullOrEmpty(brokerUserId))
                await credentials.UpdateBrokerUserIdAsync(username, BrokerNames.Upstox, brokerUserId);
            logger.LogInformation(
                "Upstox access token generated — {User} upstoxUserId={UserId}", username, brokerUserId);
            return Results.Ok(new { AccessToken = accessToken });
        });
    }
}
