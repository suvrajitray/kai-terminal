using System.Security.Claims;
using KAITerminal.Api.Extensions;
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
        WatchedProducts       = "All",
        MtmTarget             = 15_000m,
        MtmSl                 = -20_000m,
        TrailingEnabled       = true,
        TrailingActivateAt    = 5_000m,
        LockProfitAt          = 1_000m,
        IncreaseBy            = 100m,
        TrailBy               = 50m,
        AutoShiftEnabled      = false,
        AutoShiftThresholdPct = 35m,
        AutoShiftMaxCount     = 1,
        AutoShiftStrikeGap    = 1,
    };

    public static void MapRiskConfigEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/risk-config", async (
            ClaimsPrincipal user,
            IRiskConfigService svc,
            [Microsoft.AspNetCore.Mvc.FromQuery] string broker = "upstox") =>
        {
            var username = user.GetEmail()!;
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
            var username = user.GetEmail()!;
            // Auto-shift requires PP to be active — enforce this invariant on every save.
            if (!body.Enabled)
                body.AutoShiftEnabled = false;
            await svc.UpsertAsync(username, broker, body);
            return Results.NoContent();
        })
        .RequireAuthorization();
    }
}
