using System.Security.Claims;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;

namespace KAITerminal.Api.Endpoints;

public static class BrokerCredentialsEndpoints
{
    public static void MapBrokerCredentialsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/broker-credentials").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal user, BrokerCredentialService svc) =>
        {
            var username = GetEmail(user);
            if (username is null) return Results.Unauthorized();

            var credentials = await svc.GetAsync(username);
            return Results.Ok(credentials);
        });

        group.MapPost("/", async (
            SaveBrokerCredentialRequest request,
            ClaimsPrincipal user,
            BrokerCredentialService svc,
            ILoggerFactory lf) =>
        {
            var username = GetEmail(user);
            if (username is null) return Results.Unauthorized();

            await svc.UpsertAsync(username, request);
            lf.CreateLogger("BrokerCredentialsEndpoints").LogInformation(
                "Broker credentials saved — {User} ({Broker})", username, request.BrokerName);
            return Results.Ok();
        });

        group.MapPut("/{brokerName}/access-token", async (
            string brokerName,
            UpdateAccessTokenRequest request,
            ClaimsPrincipal user,
            BrokerCredentialService svc,
            ILoggerFactory lf) =>
        {
            var username = GetEmail(user);
            if (username is null) return Results.Unauthorized();

            await svc.UpdateAccessTokenAsync(username, brokerName, request.AccessToken);
            lf.CreateLogger("BrokerCredentialsEndpoints").LogInformation(
                "Broker access token updated — {User} ({Broker})", username, brokerName);
            return Results.NoContent();
        });

        group.MapDelete("/{brokerName}", async (
            string brokerName,
            ClaimsPrincipal user,
            BrokerCredentialService svc,
            ILoggerFactory lf) =>
        {
            var username = GetEmail(user);
            if (username is null) return Results.Unauthorized();

            var deleted = await svc.DeleteAsync(username, brokerName);
            if (deleted)
                lf.CreateLogger("BrokerCredentialsEndpoints").LogInformation(
                    "Broker credentials deleted — {User} ({Broker})", username, brokerName);
            return deleted ? Results.NoContent() : Results.NotFound();
        });
    }

    private static string? GetEmail(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirst("email")?.Value;
}
