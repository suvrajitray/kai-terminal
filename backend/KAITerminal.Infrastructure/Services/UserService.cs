using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Infrastructure.Services;

public interface IUserService
{
    Task<AppUser> EnsureExistsAsync(string email, string name);
    Task<AppUser?> FindAsync(string email);
}

public sealed class UserService(AppDbContext db) : IUserService
{
    private const string AdminEmail = "suvrajit.ray@gmail.com";

    public async Task<AppUser> EnsureExistsAsync(string email, string name)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is not null) return user;

        var isAdmin = string.Equals(email, AdminEmail, StringComparison.OrdinalIgnoreCase);
        user = new AppUser
        {
            Email     = email,
            Name      = name,
            IsActive  = isAdmin,
            IsAdmin   = isAdmin,
            CreatedAt = DateTime.UtcNow,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public Task<AppUser?> FindAsync(string email) =>
        db.Users.FirstOrDefaultAsync(u => u.Email == email);
}
