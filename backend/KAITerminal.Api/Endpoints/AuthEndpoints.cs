using System.Security.Claims;
using KAITerminal.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;

namespace KAITerminal.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/auth/google", async (HttpContext context) =>
        {
            await context.ChallengeAsync(GoogleDefaults.AuthenticationScheme,
                new AuthenticationProperties
                {
                    RedirectUri = "/auth/google/callback"
                });
        });

        app.MapGet("/auth/google/callback", async (HttpContext ctx, JwtService jwtService, IConfiguration config) =>
        {
            var result = await ctx.AuthenticateAsync(GoogleDefaults.AuthenticationScheme);
            if (!result.Succeeded) return Results.Unauthorized();

            var user = result.Principal!;

            var token = jwtService.GenerateToken(
                user.FindFirstValue(ClaimTypes.NameIdentifier)!,
                user.FindFirstValue(ClaimTypes.Name)!,
                user.FindFirstValue(ClaimTypes.Email)!
            );

            return Results.Redirect(
                $"{config["Frontend:Url"]}/auth/callback?token={token}"
            );
        });

        app.MapGet("/api/profile", (ClaimsPrincipal user) =>
        {
            return Results.Ok(new
            {
                name = string.IsNullOrWhiteSpace(user.FindFirstValue(ClaimTypes.Name))
                    ? user.FindFirst("name")?.Value
                    : user.FindFirstValue(ClaimTypes.Name),
                email = user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirst("email")?.Value
            });
        })
        .RequireAuthorization();
    }
}
