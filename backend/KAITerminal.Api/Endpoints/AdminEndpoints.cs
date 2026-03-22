using System.Security.Claims;
using KAITerminal.Infrastructure.Services;

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
    }

    private static bool IsAdmin(ClaimsPrincipal user) =>
        user.FindFirstValue("isAdmin") == "true";

    public record AnalyticsTokenRequest(string Token);
}
