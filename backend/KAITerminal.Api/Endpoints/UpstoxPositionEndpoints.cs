using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Endpoints;

internal static class UpstoxPositionEndpoints
{
    internal static void Map(RouteGroupBuilder group, ILogger logger)
    {
        group.MapGet("/positions", async (
            UpstoxClient upstox,
            [FromQuery] string? exchange = null) =>
        {
            var positions = await upstox.Positions.GetAllPositionsAsync();
            return Results.Ok(FilterByExchange(positions, exchange).Select(p => p.ToResponse()));
        });

        group.MapPost("/positions/exit-all", async (
            UpstoxClient upstox,
            ClaimsPrincipal user,
            [FromQuery] string? exchange = null) =>
        {
            var email = user.GetEmail() ?? "unknown";
            var filterDesc = string.IsNullOrWhiteSpace(exchange) ? "all exchanges" : exchange;
            logger.LogInformation("Exit all positions — {User} — filter: {Filter}", email, filterDesc);

            var exchanges = string.IsNullOrWhiteSpace(exchange)
                ? null
                : exchange.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                          .ToList()
                          .AsReadOnly();
            var ids = await upstox.Positions.ExitAllPositionsAsync(exchanges);

            logger.LogInformation(
                "Exit all complete — {User} — {Count} order(s) placed", email, ids.Count);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapPost("/positions/{instrumentToken}/exit", async (
            string instrumentToken,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            [FromQuery] string product = "I") =>
        {
            var id = await upstox.Positions.ExitPositionAsync(instrumentToken, product);
            logger.LogInformation(
                "Exit position — {User} — {Token} ({Product}) — order {OrderId}",
                user.GetEmail() ?? "unknown", instrumentToken, product, id);
            return Results.Ok(new { OrderId = id });
        });

        group.MapPost("/positions/{instrumentToken}/convert", async (
            string instrumentToken,
            [FromBody] ConvertPositionRequest request,
            UpstoxClient upstox,
            ClaimsPrincipal user) =>
        {
            await upstox.Positions.ConvertPositionAsync(instrumentToken, request.OldProduct, request.Quantity);
            logger.LogInformation(
                "Convert position — {User} — {Token} qty={Qty} from {OldProduct}",
                user.GetEmail() ?? "unknown",
                instrumentToken, request.Quantity, request.OldProduct);
            return Results.Ok();
        });

        group.MapPost("/positions/shift", async (
            [FromBody] ShiftPositionRequest request,
            PositionShiftService shiftSvc,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            CancellationToken ct) =>
            await shiftSvc.ShiftUpstoxAsync(
                request, upstox, user.GetEmail() ?? "unknown", logger, ct));
    }

    private static IReadOnlyList<BrokerPosition> FilterByExchange(
        IReadOnlyList<BrokerPosition> positions, string? exchange)
    {
        if (string.IsNullOrWhiteSpace(exchange))
            return positions;

        var exchanges = exchange
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToUpperInvariant())
            .ToHashSet();

        return positions
            .Where(p => exchanges.Contains(p.Exchange.ToUpperInvariant()))
            .ToList()
            .AsReadOnly();
    }
}
