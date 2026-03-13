namespace KAITerminal.Infrastructure.Data;

public class UserTradingSettings
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public decimal DefaultStoplossPercentage { get; set; } = 30m;
    public int NiftyShiftOffset { get; set; } = 5;
    public int BankniftyShiftOffset { get; set; } = 10;
    public int MidcpniftyShiftOffset { get; set; } = 10;
    public int FinniftyShiftOffset { get; set; } = 10;
    public int SensexShiftOffset { get; set; } = 10;
    public int BankexShiftOffset { get; set; } = 10;
    public string IndexChangeMode { get; set; } = "prevClose";
    public DateTime UpdatedAt { get; set; }
}
