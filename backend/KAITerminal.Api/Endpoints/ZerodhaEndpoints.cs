using KAITerminal.Api.Models;
using KAITerminal.Broker.Interfaces;
using KAITerminal.Types;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.Api.Endpoints;

public static class ZerodhaEndpoints
{
    public static void MapZerodhaEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/zerodha");

        group.MapGet("/positions", async (
            [FromHeader(Name = "X-Zerodha-AccessToken")] string accessToken,
            IPositionProvider positionProvider) =>
        {
            var positions = await positionProvider.GetOpenPositionsAsync(new AccessToken(accessToken));
            return Results.Ok(positions);
        });

        group.MapGet("/mtm", async (
            [FromHeader(Name = "X-Zerodha-AccessToken")] string accessToken,
            IPositionProvider positionProvider) =>
        {
            var mtm = await positionProvider.GetCurrentMtmAsync(new AccessToken(accessToken));
            return Results.Ok(new { Mtm = mtm });
        });

        group.MapPost("/access-token", async (
            [FromBody] ZerodhaTokenRequest request,
            ITokenGenerator tokenGenerator) =>
        {
            var token = await tokenGenerator.GenerateAccessTokenAsync(
                request.ApiKey,
                request.ApiSecret,
                request.RequestToken);
            return Results.Ok(new { AccessToken = token.Value });
        });
    }
}
