using KAITerminal.Infrastructure.Services;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Upstox;
using KAITerminal.Zerodha;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.Api.Endpoints;

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin").RequireAuthorization("AdminOnly");

        group.MapGet("/analytics-token", async (
            IAppSettingService svc,
            CancellationToken ct) =>
        {
            var token = await svc.GetAsync(AppSettingKeys.UpstoxAnalyticsToken, ct);
            return Results.Ok(new { token = token ?? "" });
        });

        group.MapPut("/analytics-token", async (
            IAppSettingService svc,
            AnalyticsTokenRequest body,
            CancellationToken ct) =>
        {
            await svc.SetAsync(AppSettingKeys.UpstoxAnalyticsToken, body.Token, ct);
            return Results.NoContent();
        });

        group.MapGet("/users", async (
            AdminService adminSvc,
            CancellationToken ct) =>
            Results.Ok(await adminSvc.GetUsersAsync(ct)));

        group.MapPatch("/users/{id:int}/active", async (
            int id,
            IUserService userSvc,
            SetActiveRequest body) =>
        {
            var found = await userSvc.SetActiveAsync(id, body.IsActive);
            return found ? Results.NoContent() : Results.NotFound();
        });

        group.MapGet("/risk-logs", async (
            AdminService adminSvc,
            [FromQuery] string? date,
            [FromQuery] int? days,
            CancellationToken ct) =>
        {
            var targetDate = DateOnly.TryParse(date, out var d) ? d : IstClock.Today;
            return Results.Ok(await adminSvc.GetRiskLogsAsync(targetDate, days ?? 1, ct));
        });

        group.MapGet("/dashboard-stats", async (
            AdminService adminSvc,
            CancellationToken ct) =>
            Results.Ok(await adminSvc.GetDashboardStatsAsync(ct)));

        group.MapGet("/risk-config", async (
            IRiskConfigService svc,
            [FromQuery] string email,
            CancellationToken ct,
            [FromQuery] string broker = "upstox") =>
            Results.Ok(await svc.GetAsync(email, broker)));

        group.MapGet("/user-brokers", async (
            BrokerCredentialService credSvc,
            [FromQuery] string email,
            CancellationToken ct) =>
        {
            var creds = await credSvc.GetAsync(email);
            var brokers = creds
                .Where(c => !string.IsNullOrEmpty(c.AccessToken))
                .Select(c => c.BrokerName)
                .ToList();
            return Results.Ok(brokers);
        });

        group.MapGet("/positions", async (
            BrokerCredentialService credSvc,
            UpstoxClient upstox,
            ZerodhaClient zerodha,
            [FromQuery] string email,
            CancellationToken ct,
            [FromQuery] string broker = "upstox") =>
        {
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
            using (ZerodhaTokenContext.Use(cred.ApiKey, cred.AccessToken))
            {
                var positions = await zerodha.Positions.GetAllPositionsAsync(ct);
                return Results.Ok(positions.Select(p => p.ToResponse()));
            }
        });
    }

    public record AnalyticsTokenRequest(string Token);
    public record SetActiveRequest(bool IsActive);
}
