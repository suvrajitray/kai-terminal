using KAITerminal.Api.Services;
using KAITerminal.Contracts.Options;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.Api.Endpoints;

public static class MasterDataEndpoints
{
    public static void MapMasterDataEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/masterdata").RequireAuthorization();

        group.MapGet("/contracts", async (
            MasterDataService svc,
            HttpContext ctx,
            CancellationToken ct) =>
        {
            var contracts = await svc.GetContractsAsync(ctx, ct);
            return Results.Ok(contracts);
        });

        group.MapGet("/options/chain", async (
            [FromQuery] string? underlyingKey,
            [FromQuery] string? expiryDate,
            IOptionChainProvider chainProvider,
            CancellationToken ct) =>
        {
            if (string.IsNullOrEmpty(underlyingKey) || string.IsNullOrEmpty(expiryDate))
                return Results.BadRequest(new { error = "underlyingKey and expiryDate are required." });
            return Results.Ok(await chainProvider.GetChainAsync(underlyingKey, expiryDate, ct));
        });
    }
}
