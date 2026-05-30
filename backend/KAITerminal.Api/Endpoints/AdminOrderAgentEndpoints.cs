using KAITerminal.Infrastructure.Data;
using KAITerminal.OrderRouting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Endpoints;

internal static class AdminOrderAgentEndpoints
{
    internal static void MapAdminOrderAgentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/admin/order-agents").RequireAuthorization("AdminOnly");

        group.MapGet("/", async (AppDbContext db) =>
            Results.Ok(await db.UserOrderAgents.ToListAsync()));

        group.MapPost("/", async (
            [FromBody] UpsertAgentRequest req,
            AppDbContext db,
            IOrderAgentRegistry registry) =>
        {
            var existing = await db.UserOrderAgents.FindAsync(req.Username);
            if (existing is null)
            {
                db.UserOrderAgents.Add(new UserOrderAgent
                {
                    Username  = req.Username,
                    AgentUrl  = req.AgentUrl,
                    StaticIp  = req.StaticIp,
                    IsEnabled = true
                });
            }
            else
            {
                existing.AgentUrl  = req.AgentUrl;
                existing.StaticIp  = req.StaticIp;
                existing.IsEnabled = true;
            }
            await db.SaveChangesAsync();
            registry.Upsert(req.Username, req.AgentUrl);
            return Results.Ok();
        });

        group.MapDelete("/{username}", async (
            string username,
            AppDbContext db,
            IOrderAgentRegistry registry) =>
        {
            var existing = await db.UserOrderAgents.FindAsync(username);
            if (existing is not null)
            {
                db.UserOrderAgents.Remove(existing);
                await db.SaveChangesAsync();
            }
            registry.Remove(username);
            return Results.Ok();
        });
    }

    internal sealed record UpsertAgentRequest(
        string Username,
        string AgentUrl,
        string StaticIp);
}
