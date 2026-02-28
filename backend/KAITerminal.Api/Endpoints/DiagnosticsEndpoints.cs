using System.Security.Claims;

namespace KAITerminal.Api.Endpoints;

public static class DiagnosticsEndpoints
{
    public static void MapDiagnosticsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/debug/claims", (ClaimsPrincipal user) =>
        {
            return user.Claims.Select(c => new { c.Type, c.Value });
        })
        .RequireAuthorization();
    }
}
