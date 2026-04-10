using System.Security.Claims;

namespace KAITerminal.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Returns the user's email from ClaimTypes.Email, with a fallback to the raw "email" claim.
    /// Returns null if neither claim is present.
    /// </summary>
    public static string? GetEmail(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirst("email")?.Value;
}
