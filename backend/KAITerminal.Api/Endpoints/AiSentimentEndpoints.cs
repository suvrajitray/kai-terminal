using KAITerminal.Api.Services;
using KAITerminal.Upstox;

namespace KAITerminal.Api.Endpoints;

public static class AiSentimentEndpoints
{
    public static void MapAiSentimentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ai").RequireAuthorization();

        group.MapGet("/market-sentiment", async (
            HttpContext ctx,
            IAiSentimentService sentiment,
            CancellationToken ct) =>
        {
            var token = ctx.Request.Headers["X-Upstox-Access-Token"].FirstOrDefault();
            if (string.IsNullOrEmpty(token))
                return Results.BadRequest(new { message = "X-Upstox-Access-Token header is required." });

            using (UpstoxTokenContext.Use(token))
            {
                var result = await sentiment.GetSentimentAsync(ct);
                return Results.Ok(result);
            }
        });
    }
}
