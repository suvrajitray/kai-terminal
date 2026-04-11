using KAITerminal.Api.Extensions;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Services;

public sealed class AdminService(AppDbContext db, IUserService userSvc)
{
    public async Task<IReadOnlyList<AdminUserDto>> GetUsersAsync(CancellationToken ct)
    {
        var startUtc = IstClock.DateToUtc(IstClock.Today);
        var onlineUsernames = await db.BrokerCredentials
            .Where(c => c.UpdatedAt >= startUtc.UtcDateTime)
            .Select(c => c.Username)
            .Distinct()
            .ToListAsync(ct);

        var users = await userSvc.GetAllAsync();
        return users.Select(u => new AdminUserDto(
            u.Id, u.Email, u.Name, u.IsActive, u.IsAdmin, u.CreatedAt,
            onlineUsernames.Contains(u.Email)
        )).ToList();
    }

    public async Task<AdminDashboardStats> GetDashboardStatsAsync(CancellationToken ct)
    {
        var startUtc  = IstClock.DateToUtc(IstClock.Today);
        var total     = await db.Users.CountAsync(ct);
        var active    = await db.Users.CountAsync(u => u.IsActive, ct);
        var online    = await db.BrokerCredentials
            .Where(c => c.UpdatedAt >= startUtc.UtcDateTime)
            .Select(c => c.Username)
            .Distinct()
            .CountAsync(ct);
        return new AdminDashboardStats(total, active, online);
    }

    public async Task<IReadOnlyList<AdminRiskLogEntry>> GetRiskLogsAsync(
        DateOnly targetDate, int days, CancellationToken ct)
    {
        var startDate = targetDate.AddDays(-(days - 1));
        var startUtc  = IstClock.DateToUtc(startDate);
        var endUtc    = IstClock.DateToUtc(targetDate.AddDays(1));

        return await db.RiskEngineLogs
            .Where(e => e.Timestamp >= startUtc && e.Timestamp < endUtc)
            .OrderByDescending(e => e.Timestamp)
            .Take(1000)
            .Select(e => new AdminRiskLogEntry(
                e.Id, e.Username, e.EventType, e.BrokerType,
                e.Mtm, e.Sl, e.Target, e.TslFloor,
                e.InstrumentToken, e.ShiftCount, e.Timestamp))
            .ToListAsync(ct);
    }
}

public record AdminUserDto(
    int Id, string Email, string Name, bool IsActive, bool IsAdmin,
    DateTime CreatedAt, bool IsOnline = false);

public record AdminDashboardStats(int TotalUsers, int ActiveUsers, int OnlineUsers);

public record AdminRiskLogEntry(
    long Id, string User, string Type, string Broker,
    decimal Mtm, decimal? Sl, decimal? Target, decimal? TslFloor,
    string? InstrumentToken, int? ShiftCount, DateTimeOffset Timestamp);
