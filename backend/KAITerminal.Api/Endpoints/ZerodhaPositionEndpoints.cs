using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.MarketData.Services;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Endpoints;

internal static class ZerodhaPositionEndpoints
{
    internal static void Map(RouteGroupBuilder group, ILogger logger)
    {
        group.MapGet("/positions", async (
            ZerodhaClient zerodha,
            [FromQuery] string? exchange,
            CancellationToken ct) =>
        {
            var positions = await zerodha.Positions.GetAllPositionsAsync(ct);
            if (!string.IsNullOrWhiteSpace(exchange))
            {
                var exchanges = exchange.Split(',')
                    .Select(e => e.Trim().ToUpperInvariant())
                    .ToHashSet();
                positions = positions
                    .Where(p => exchanges.Contains(p.Exchange.ToUpperInvariant()))
                    .ToList();
            }
            return Results.Ok(positions.Select(p => p.ToResponse()));
        });

        group.MapPost("/positions/exit-all", async (
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            [FromQuery] string? exchange = null,
            CancellationToken ct = default) =>
        {
            var exchanges = string.IsNullOrWhiteSpace(exchange)
                ? null
                : exchange.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                          .ToList()
                          .AsReadOnly();
            await zerodha.Positions.ExitAllPositionsAsync(exchanges, ct);
            logger.LogInformation(
                "Exit all positions — {User}", user.GetEmail() ?? "unknown");
            return Results.Ok();
        });

        group.MapPost("/positions/{instrumentToken}/convert", async (
            string instrumentToken,
            [FromBody] ZerodhaConvertRequest request,
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            await zerodha.Positions.ConvertPositionAsync(instrumentToken, request.OldProduct, request.Quantity, ct);
            logger.LogInformation(
                "Convert position — {User} — {Token} qty={Qty} from {OldProduct}",
                user.GetEmail() ?? "unknown",
                instrumentToken, request.Quantity, request.OldProduct);
            return Results.Ok();
        });

        group.MapPost("/positions/shift", async (
            [FromBody] ShiftPositionRequest request,
            PositionShiftService shiftSvc,
            ZerodhaClient zerodha,
            IZerodhaInstrumentService zerodhaInstruments,
            ClaimsPrincipal user,
            CancellationToken ct) =>
            await shiftSvc.ShiftZerodhaAsync(
                request, zerodha, zerodhaInstruments,
                user.GetEmail() ?? "unknown", logger, ct));

        group.MapPost("/positions/{instrumentToken}/exit", async (
            string instrumentToken,
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            [FromQuery] string product = "NRML",
            CancellationToken ct = default) =>
        {
            await zerodha.Positions.ExitPositionAsync(instrumentToken, product, ct);
            logger.LogInformation(
                "Exit position — {User} — {Token}",
                user.GetEmail() ?? "unknown", instrumentToken);
            return Results.Ok();
        });
    }

    private sealed record ZerodhaConvertRequest(string OldProduct, int Quantity);
}
