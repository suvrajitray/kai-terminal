using KAITerminal.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.Api.Endpoints;

public static class MasterDataEndpoints
{
    private static readonly HashSet<string> SupportedBrokers = ["upstox", "zerodha"];

    public static void MapMasterDataEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/masterdata").RequireAuthorization();

        group.MapGet("/contracts", async (
            [FromQuery] string broker,
            MasterDataService svc,
            HttpContext ctx,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(broker) || !SupportedBrokers.Contains(broker))
                return Results.BadRequest(new { error = $"broker '{broker}' is not supported." });

            var contracts = await svc.GetContractsAsync(broker, ctx, ct);
            return Results.Ok(contracts);
        });
    }
}
