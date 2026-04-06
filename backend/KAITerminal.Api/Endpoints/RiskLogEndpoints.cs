using System.Security.Claims;
using KAITerminal.Infrastructure.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Endpoints;

public static class RiskLogEndpoints
{
    public static void MapRiskLogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/risk-log").RequireAuthorization();

        // GET /api/risk-log?date=2026-04-06  (defaults to today IST)
        group.MapGet("", async (
            HttpContext ctx,
            AppDbContext db,
            [Microsoft.AspNetCore.Mvc.FromQuery] string? date,
            CancellationToken ct) =>
        {
            var userId = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? ctx.User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            // Parse requested date (YYYY-MM-DD) or default to today in IST
            var tz      = TimeZoneInfo.FindSystemTimeZoneById("Asia/Calcutta");
            var todayIst = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz).Date;
            var targetDate = DateOnly.TryParse(date, out var d) ? d : DateOnly.FromDateTime(todayIst);

            var startUtc = new DateTimeOffset(targetDate.ToDateTime(TimeOnly.MinValue), tz.GetUtcOffset(targetDate.ToDateTime(TimeOnly.MinValue))).ToUniversalTime();
            var endUtc   = startUtc.AddDays(1);

            var entries = await db.RiskEngineLogs
                .Where(e => e.Username == userId
                         && e.Timestamp >= startUtc
                         && e.Timestamp < endUtc)
                .OrderByDescending(e => e.Timestamp)
                .Take(500)
                .Select(e => new
                {
                    e.Id,
                    type            = e.EventType,
                    broker          = e.BrokerType,
                    e.Mtm,
                    sl              = e.Sl,
                    target          = e.Target,
                    tslFloor        = e.TslFloor,
                    instrumentToken = e.InstrumentToken,
                    shiftCount      = e.ShiftCount,
                    timestamp       = e.Timestamp,
                })
                .ToListAsync(ct);

            return Results.Ok(entries);
        });
    }
}
