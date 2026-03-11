using System.Security.Claims;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;

namespace KAITerminal.Api.Endpoints;

public static class UserSettingsEndpoints
{
    public static void MapUserSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/user-settings").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal user, UserTradingSettingsService svc) =>
        {
            var username = GetEmail(user);
            if (username is null) return Results.Unauthorized();

            return Results.Ok(await svc.GetAsync(username));
        });

        group.MapPut("/", async (
            SaveUserTradingSettingsRequest request,
            ClaimsPrincipal user,
            UserTradingSettingsService svc) =>
        {
            var username = GetEmail(user);
            if (username is null) return Results.Unauthorized();

            await svc.SaveAsync(username, request);
            return Results.NoContent();
        });
    }

    private static string? GetEmail(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirst("email")?.Value;
}
