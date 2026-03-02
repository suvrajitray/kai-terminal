using KAITerminal.Api.Models;
using KAITerminal.Upstox;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.Api.Endpoints;

public static class UpstoxEndpoints
{
    public static void MapUpstoxEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/upstox");

        group.MapGet("/positions", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var positions = await upstox.GetAllPositionsAsync();
                return Results.Ok(positions);
            }
        });

        group.MapGet("/mtm", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var mtm = await upstox.GetTotalMtmAsync();
                return Results.Ok(new { Mtm = mtm });
            }
        });

        group.MapPost("/access-token", async (
            [FromBody] UpstoxTokenRequest request,
            UpstoxClient upstox) =>
        {
            var token = await upstox.GenerateTokenAsync(
                request.ApiKey,
                request.ApiSecret,
                request.RedirectUri,
                request.Code);
            return Results.Ok(new { AccessToken = token.AccessToken });
        });
    }
}
