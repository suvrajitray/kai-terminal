using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Serilog.Context;

namespace KAITerminal.Api.Endpoints;

public static class ClientLogEndpoints
{
    record ClientLogRequest(string Level, string Namespace, string Message);

    public static void MapClientLogEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/client-log", (
            ClientLogRequest req,
            HttpContext ctx,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("KAITerminal.Api.ClientLog");
            var username = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? ctx.User.FindFirstValue(ClaimTypes.Email)
                        ?? "unknown";

            using var _s = LogContext.PushProperty("Source", "Frontend");
            using var _n = LogContext.PushProperty("FrontendNamespace", req.Namespace);
            using var _u = LogContext.PushProperty("FrontendUser", username);

            switch (req.Level.ToLowerInvariant())
            {
                case "error":
                    logger.LogError("[FE:{Namespace}] {Message}", req.Namespace, req.Message);
                    break;
                default:
                    logger.LogWarning("[FE:{Namespace}] {Message}", req.Namespace, req.Message);
                    break;
            }

            return Results.NoContent();
        }).RequireAuthorization();
    }
}
