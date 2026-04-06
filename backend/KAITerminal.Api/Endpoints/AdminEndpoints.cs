using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using KAITerminal.Infrastructure.Services;
using KAITerminal.Infrastructure.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace KAITerminal.Api.Endpoints;

public static class AdminEndpoints
{

    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin").RequireAuthorization();

        group.MapGet("/analytics-token", async (
            ClaimsPrincipal user,
            IAppSettingService svc,
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var token = await svc.GetAsync(AppSettingKeys.UpstoxAnalyticsToken, ct);
            return Results.Ok(new { token = token ?? "" });
        });

        group.MapPut("/analytics-token", async (
            ClaimsPrincipal user,
            IAppSettingService svc,
            AnalyticsTokenRequest body,
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            await svc.SetAsync(AppSettingKeys.UpstoxAnalyticsToken, body.Token, ct);
            return Results.NoContent();
        });

        group.MapGet("/users", async (
            ClaimsPrincipal user,
            IUserService userSvc,
            AppDbContext db,
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();

            var tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Calcutta");
            var todayIst = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz).Date;
            var startUtc = new DateTimeOffset(todayIst, tz.GetUtcOffset(todayIst)).ToUniversalTime();

            var onlineUsernames = await db.BrokerCredentials
                .Where(c => c.UpdatedAt >= startUtc.UtcDateTime)
                .Select(c => c.Username)
                .Distinct()
                .ToListAsync(ct);

            var users = await userSvc.GetAllAsync();
            var result = users.Select(u => new UserDto(
                u.Id, 
                u.Email, 
                u.Name, 
                u.IsActive, 
                u.IsAdmin, 
                u.CreatedAt, 
                onlineUsernames.Contains(u.Email)
            ));
            return Results.Ok(result);
        });

        group.MapPatch("/users/{id:int}/active", async (
            int id,
            ClaimsPrincipal user,
            IUserService userSvc,
            SetActiveRequest body,
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var found = await userSvc.SetActiveAsync(id, body.IsActive);
            return found ? Results.NoContent() : Results.NotFound();
        });

        group.MapGet("/risk-logs", async (
            ClaimsPrincipal user,
            AppDbContext db,
            [Microsoft.AspNetCore.Mvc.FromQuery] string? date,
            [Microsoft.AspNetCore.Mvc.FromQuery] int? days,
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();

            var tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Calcutta");
            var todayIst = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz).Date;
            var targetDate = DateOnly.TryParse(date, out var d) ? d : DateOnly.FromDateTime(todayIst);

            var requestDays = days ?? 1;
            var startDate = targetDate.AddDays(-(requestDays - 1));

            var startUtc = new DateTimeOffset(startDate.ToDateTime(TimeOnly.MinValue), tz.GetUtcOffset(startDate.ToDateTime(TimeOnly.MinValue))).ToUniversalTime();
            var endUtc   = new DateTimeOffset(targetDate.AddDays(1).ToDateTime(TimeOnly.MinValue), tz.GetUtcOffset(targetDate.AddDays(1).ToDateTime(TimeOnly.MinValue))).ToUniversalTime();

            var entries = await db.RiskEngineLogs
                .Where(e => e.Timestamp >= startUtc && e.Timestamp < endUtc)
                .OrderByDescending(e => e.Timestamp)
                .Take(1000)
                .Select(e => new
                {
                    e.Id,
                    user            = e.Username,
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

        group.MapGet("/dashboard-stats", async (
            ClaimsPrincipal user,
            AppDbContext db,
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();

            var tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Calcutta");
            var todayIst = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz).Date;
            var startUtc = new DateTimeOffset(todayIst, tz.GetUtcOffset(todayIst)).ToUniversalTime();

            var totalUsers = await db.Users.CountAsync(ct);
            var activeUsers = await db.Users.CountAsync(u => u.IsActive, ct);
            var onlineUsers = await db.BrokerCredentials
                .Where(c => c.UpdatedAt >= startUtc.UtcDateTime)
                .Select(c => c.Username)
                .Distinct()
                .CountAsync(ct);

            return Results.Ok(new {
                totalUsers,
                activeUsers,
                onlineUsers
            });
        });
    }

    private static bool IsAdmin(ClaimsPrincipal user) =>
        user.FindFirstValue("isAdmin") == "true";

    public record AnalyticsTokenRequest(string Token);
    public record SetActiveRequest(bool IsActive);
    public record UserDto(int Id, string Email, string Name, bool IsActive, bool IsAdmin, DateTime CreatedAt, bool IsOnline = false);
}
