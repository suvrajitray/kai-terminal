namespace KAITerminal.Infrastructure.Data;

/// <summary>
/// Generic key-value store for admin-managed application settings.
/// Currently used to store the Upstox analytics token for master data fetching.
/// Key is the primary key — one row per setting.
/// </summary>
public class AppSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}
