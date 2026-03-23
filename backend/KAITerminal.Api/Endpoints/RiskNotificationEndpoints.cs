using KAITerminal.Contracts.Notifications;

namespace KAITerminal.Api.Endpoints;

public static class RiskNotificationEndpoints
{
    public static IEndpointRouteBuilder MapRiskNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/internal/risk-event", async (
            HttpContext ctx,
            IRiskEventNotifier notifier,
            IConfiguration config,
            RiskNotification notification,
            CancellationToken ct) =>
        {
            var expectedKey = config["Api:InternalKey"];
            if (string.IsNullOrEmpty(expectedKey))
                return Results.StatusCode(503);

            var providedKey = ctx.Request.Headers["X-Internal-Key"].FirstOrDefault();
            if (providedKey != expectedKey)
                return Results.Unauthorized();

            await notifier.NotifyAsync(notification, ct);
            return Results.Ok();
        })
        .ExcludeFromDescription();

        return app;
    }
}
