using KAITerminal.Api.Services;
using KAITerminal.Contracts.Options;
using KAITerminal.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

        group.MapGet("/iv-history", async (
            [FromQuery] string? underlying,
            [FromQuery] int? lookbackDays,
            AppDbContext db,
            CancellationToken ct) =>
        {
            if (string.IsNullOrEmpty(underlying))
                return Results.BadRequest(new { error = "underlying is required." });
            var days = lookbackDays is > 0 ? lookbackDays.Value : 252;

            var rows = await db.IvSnapshots
                .Where(s => s.Underlying == underlying.ToUpperInvariant())
                .OrderByDescending(s => s.Date)
                .Take(days)
                .Select(s => new { s.Date, s.AtmIv, s.SpotPrice, s.AtmCallLtp, s.AtmPutLtp })
                .ToListAsync(ct);

            return Results.Ok(rows.OrderBy(r => r.Date));
        });
    }
}
