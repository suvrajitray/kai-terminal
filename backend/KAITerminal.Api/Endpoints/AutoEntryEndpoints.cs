using KAITerminal.Api.Extensions;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.Api.Endpoints;

public static class AutoEntryEndpoints
{
    public static void MapAutoEntryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auto-entry").RequireAuthorization();

        // GET /api/auto-entry — list all strategies for the caller
        group.MapGet("", async (HttpContext ctx, IAutoEntryConfigService svc, CancellationToken ct) =>
        {
            var username = ctx.User.GetEmail()!;
            var configs  = await svc.GetAllForUserAsync(username, ct);
            return Results.Ok(configs.Select(ToDto));
        });

        // POST /api/auto-entry — create a new strategy
        group.MapPost("", async (HttpContext ctx, [FromBody] AutoEntryDto body, IAutoEntryConfigService svc, CancellationToken ct) =>
        {
            var username = ctx.User.GetEmail()!;
            var template = FromDto(body);
            var created  = await svc.CreateAsync(username, template, ct);
            return Results.Created($"/api/auto-entry/{created.Id}", ToDto(created));
        });

        // PUT /api/auto-entry/{id} — update an existing strategy
        group.MapPut("{id:int}", async (int id, HttpContext ctx, [FromBody] AutoEntryDto body, IAutoEntryConfigService svc, CancellationToken ct) =>
        {
            var username = ctx.User.GetEmail()!;
            var patch    = FromDto(body);
            var updated  = await svc.UpdateAsync(id, username, patch, ct);
            return updated is null ? Results.NotFound() : Results.Ok(ToDto(updated));
        });

        // DELETE /api/auto-entry/{id}
        group.MapDelete("{id:int}", async (int id, HttpContext ctx, IAutoEntryConfigService svc, CancellationToken ct) =>
        {
            var username = ctx.User.GetEmail()!;
            var deleted  = await svc.DeleteAsync(id, username, ct);
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        // GET /api/auto-entry/status — today's entry status for all user strategies
        group.MapGet("status", async (HttpContext ctx, IAutoEntryConfigService svc, CancellationToken ct) =>
        {
            var username  = ctx.User.GetEmail()!;
            var todayIst  = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
                                TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata")).ToString("yyyy-MM-dd");
            var logs      = await svc.GetTodayLogsForUserAsync(username, todayIst, ct);
            var logByStrat = logs.ToDictionary(l => l.StrategyId);

            var configs = await svc.GetAllForUserAsync(username, ct);
            var result  = configs.Select(c => new
            {
                strategyId   = c.Id,
                enteredToday = logByStrat.ContainsKey(c.Id),
                enteredAtUtc = logByStrat.TryGetValue(c.Id, out var log) ? log.EnteredAtUtc : (DateTime?)null,
            });
            return Results.Ok(result);
        });
    }

    private static AutoEntryDto ToDto(AutoEntryConfig c) => new(
        c.Id, c.BrokerType, c.Name, c.Enabled, c.Instrument, c.OptionType, c.Lots,
        c.EntryAfterTime, c.NoEntryAfterTime,
        c.TradingDays.Split(',', StringSplitOptions.RemoveEmptyEntries),
        c.ExcludeExpiryDay, c.OnlyExpiryDay, c.ExpiryOffset, c.StrikeMode, c.StrikeParam,
        c.CreatedAt, c.UpdatedAt);

    private static AutoEntryConfig FromDto(AutoEntryDto d) => new()
    {
        BrokerType      = d.BrokerType,
        Name            = d.Name,
        Enabled         = d.Enabled,
        Instrument      = d.Instrument,
        OptionType      = d.OptionType,
        Lots            = d.Lots,
        EntryAfterTime   = d.EntryAfterTime,
        NoEntryAfterTime = d.NoEntryAfterTime,
        TradingDays      = string.Join(",", d.TradingDays),
        ExcludeExpiryDay = d.ExcludeExpiryDay,
        OnlyExpiryDay   = d.OnlyExpiryDay,
        ExpiryOffset    = d.ExpiryOffset,
        StrikeMode      = d.StrikeMode,
        StrikeParam     = d.StrikeParam,
    };
}

public record AutoEntryDto(
    int      Id,
    string   BrokerType,
    string   Name,
    bool     Enabled,
    string   Instrument,
    string   OptionType,
    int      Lots,
    string   EntryAfterTime,
    string   NoEntryAfterTime,
    string[] TradingDays,
    bool     ExcludeExpiryDay,
    bool     OnlyExpiryDay,
    int      ExpiryOffset,
    string   StrikeMode,
    decimal  StrikeParam,
    DateTime CreatedAt,
    DateTime UpdatedAt);
