using System.Security.Claims;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Infrastructure.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace KAITerminal.Api.Endpoints;

public static class RiskConfigEndpoints
{
    private static readonly UserRiskConfig Defaults = new()
    {
        Enabled               = false,
        MtmTarget             = 25_000m,
        MtmSl                 = -25_000m,
        TrailingEnabled       = true,
        TrailingActivateAt    = 12_000m,
        LockProfitAt          = 2_000m,
        IncreaseBy            = 99m,
        TrailBy               = 33m,
        AutoShiftEnabled      = false,
        AutoShiftThresholdPct = 30m,
        AutoShiftMaxCount     = 2,
        AutoShiftStrikeGap    = 1,
        WatchedProducts       = "All",
    };

    public static void MapRiskConfigEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/risk-config", async (
            ClaimsPrincipal user,
            IRiskConfigService svc,
            [Microsoft.AspNetCore.Mvc.FromQuery] string broker = "upstox") =>
        {
            var username = user.FindFirstValue(ClaimTypes.Email)!;
            var config   = await svc.GetAsync(username, broker) ?? Defaults;
            return Results.Ok(config);
        })
        .RequireAuthorization();

        app.MapPut("/api/risk-config", async (
            ClaimsPrincipal user,
            IRiskConfigService svc,
            UserRiskConfig body,
            [Microsoft.AspNetCore.Mvc.FromQuery] string broker = "upstox") =>
        {
            var username = user.FindFirstValue(ClaimTypes.Email)!;
            // Auto-shift requires PP to be active — enforce this invariant on every save.
            if (!body.Enabled)
                body.AutoShiftEnabled = false;
            await svc.UpsertAsync(username, broker, body);
            return Results.NoContent();
        })
        .RequireAuthorization();
    }
}
