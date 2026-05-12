using KAITerminal.Api.Models;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Endpoints;

public static class UpstoxEndpoints
{
    public static void MapUpstoxEndpoints(this IEndpointRouteBuilder app)
    {
        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
                        .CreateLogger("UpstoxEndpoints");
        var group = app.MapGroup("/api/upstox").RequireAuthorization();

        UpstoxAuthEndpoints.Map(group, logger);
        UpstoxPositionEndpoints.Map(group, logger);
        UpstoxOrderEndpoints.Map(group, logger);

        // ── Funds ─────────────────────────────────────────────────────────────

        group.MapGet("/funds", async (UpstoxClient upstox, CancellationToken ct) =>
        {
            try
            {
                var funds = await upstox.Funds.GetFundsAsync(ct);
                return Results.Ok(new
                {
                    availableMargin = funds.Available,
                    usedMargin      = funds.Used,
                    payinAmount     = funds.Payin,
                });
            }
            catch (UpstoxException)
            {
                // Funds API is unavailable outside 05:30–00:00 IST — return null so the
                // frontend shows "—" rather than crashing.
                return Results.Ok(new { availableMargin = (decimal?)null, usedMargin = (decimal?)null, payinAmount = (decimal?)null });
            }
        });

        // ── Margin ────────────────────────────────────────────────────────────

        group.MapPost("/margin", async (
            [FromBody] MarginRequest request,
            UpstoxClient upstox) =>
        {
            var items = request.Instruments.Select(i =>
                new BrokerMarginOrderItem(i.InstrumentToken, i.Quantity, i.Product, i.TransactionType));
            var margin = await upstox.Margin.GetRequiredMarginAsync(items);
            return Results.Ok(new { requiredMargin = margin.RequiredMargin, finalMargin = margin.FinalMargin });
        });
    }
}
