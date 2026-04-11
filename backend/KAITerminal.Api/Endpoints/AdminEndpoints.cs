using System.Security.Claims;
using KAITerminal.Infrastructure.Services;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Services;
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
            AdminService adminSvc,
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            return Results.Ok(await adminSvc.GetUsersAsync(ct));
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
            AdminService adminSvc,
            [Microsoft.AspNetCore.Mvc.FromQuery] string? date,
            [Microsoft.AspNetCore.Mvc.FromQuery] int? days,
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var targetDate = DateOnly.TryParse(date, out var d) ? d : IstClock.Today;
            return Results.Ok(await adminSvc.GetRiskLogsAsync(targetDate, days ?? 1, ct));
        });

        group.MapGet("/dashboard-stats", async (
            ClaimsPrincipal user,
            AdminService adminSvc,
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            return Results.Ok(await adminSvc.GetDashboardStatsAsync(ct));
        });
    }

    private static bool IsAdmin(ClaimsPrincipal user) =>
        user.FindFirstValue("isAdmin") == "true";

    public record AnalyticsTokenRequest(string Token);
    public record SetActiveRequest(bool IsActive);
}
