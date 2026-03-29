using System.Security.Claims;
using KAITerminal.Infrastructure.Services;
using KAITerminal.Infrastructure.Data;

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
            CancellationToken ct) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var users = await userSvc.GetAllAsync();
            var result = users.Select(u => new UserDto(u.Id, u.Email, u.Name, u.IsActive, u.IsAdmin, u.CreatedAt));
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
    }

    private static bool IsAdmin(ClaimsPrincipal user) =>
        user.FindFirstValue("isAdmin") == "true";

    public record AnalyticsTokenRequest(string Token);
    public record SetActiveRequest(bool IsActive);
    public record UserDto(int Id, string Email, string Name, bool IsActive, bool IsAdmin, DateTime CreatedAt);
}
