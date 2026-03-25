using System.Security.Claims;
using KAITerminal.Auth.Services;
using KAITerminal.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Auth.Endpoints;

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

        app.MapGet("/auth/google/callback", async (
            HttpContext ctx,
            JwtService jwtService,
            IUserService userService,
            IConfiguration config,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("KAITerminal.Auth.AuthEndpoints");

            var result = await ctx.AuthenticateAsync(GoogleDefaults.AuthenticationScheme);
            if (!result.Succeeded)
            {
                logger.LogWarning("Google OAuth callback failed — authentication result unsuccessful");
                return Results.Unauthorized();
            }

            var principal = result.Principal!;
            var email = principal.FindFirstValue(ClaimTypes.Email)!;
            var name  = principal.FindFirstValue(ClaimTypes.Name)!;
            var sub   = principal.FindFirstValue(ClaimTypes.NameIdentifier)!;

            var user = await userService.EnsureExistsAsync(email, name);

            if (!user.IsActive)
            {
                logger.LogWarning("OAuth login — {Email} is inactive, redirecting to /auth/inactive", email);
                return Results.Redirect($"{config["Frontend:Url"]}/auth/inactive");
            }

            logger.LogInformation(
                "OAuth login — {Email} ({Name}) authenticated — admin={IsAdmin}",
                email, name, user.IsAdmin);

            var token = jwtService.GenerateToken(email, name, email, isActive: true, isAdmin: user.IsAdmin);

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
