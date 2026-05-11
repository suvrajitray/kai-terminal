using System.Security.Claims;
using KAITerminal.Infrastructure.Services;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Upstox;
using KAITerminal.Zerodha;
using Microsoft.AspNetCore.Mvc;
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

        group.MapGet("/risk-config", async (
            ClaimsPrincipal user,
            IRiskConfigService svc,
            [FromQuery] string email,
            CancellationToken ct,
            [FromQuery] string broker = "upstox") =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var config = await svc.GetAsync(email, broker);
            return Results.Ok(config);
        });

        group.MapGet("/user-brokers", async (
            ClaimsPrincipal user,
            BrokerCredentialService credSvc,
            [FromQuery] string email,
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var creds = await credSvc.GetAsync(email);
            var brokers = creds
                .Where(c => !string.IsNullOrEmpty(c.AccessToken))
                .Select(c => c.BrokerName)
                .ToList();
            return Results.Ok(brokers);
        });

        group.MapGet("/positions", async (
            ClaimsPrincipal user,
            BrokerCredentialService credSvc,
            UpstoxClient upstox,
            ZerodhaClient zerodha,
            [FromQuery] string email,
            CancellationToken ct,
            [FromQuery] string broker = "upstox") =>
        {
            if (!IsAdmin(user)) return Results.Forbid();

            var creds = await credSvc.GetAsync(email);
            var cred = creds.FirstOrDefault(c =>
                string.Equals(c.BrokerName, broker, StringComparison.OrdinalIgnoreCase));

            if (cred is null || string.IsNullOrEmpty(cred.AccessToken))
                return Results.Ok(Array.Empty<object>());

            if (string.Equals(broker, BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase))
            {
                using (UpstoxTokenContext.Use(cred.AccessToken))
                {
                    var positions = await upstox.Positions.GetAllPositionsAsync();
                    return Results.Ok(positions.Select(p => p.ToResponse()));
                }
            }
            else
            {
                using (ZerodhaTokenContext.Use(cred.ApiKey, cred.AccessToken))
                {
                    var positions = await zerodha.Positions.GetAllPositionsAsync(ct);
                    return Results.Ok(positions.Select(p => p.ToResponse()));
                }
            }
        });
    }

    private static bool IsAdmin(ClaimsPrincipal user) =>
        user.FindFirstValue("isAdmin") == "true";

    public record AnalyticsTokenRequest(string Token);
    public record SetActiveRequest(bool IsActive);
}
