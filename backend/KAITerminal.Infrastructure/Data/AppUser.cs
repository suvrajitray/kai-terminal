namespace KAITerminal.Infrastructure.Data;

public class AppUser
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsActive { get; set; } = false;
    public bool IsAdmin { get; set; } = false;
    public DateTime CreatedAt { get; set; }
}
