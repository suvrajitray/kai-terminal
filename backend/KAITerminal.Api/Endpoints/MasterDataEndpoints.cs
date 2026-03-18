using KAITerminal.Api.Services;

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
    }
}
