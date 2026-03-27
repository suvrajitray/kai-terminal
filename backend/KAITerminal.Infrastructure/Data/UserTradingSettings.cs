namespace KAITerminal.Infrastructure.Data;

public class UserTradingSettings
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public int NiftyShiftOffset { get; set; } = 1;
    public int SensexShiftOffset { get; set; } = 1;
    public int BankniftyShiftOffset { get; set; } = 1;
    public int FinniftyShiftOffset { get; set; } = 1;
    public int BankexShiftOffset { get; set; } = 1;
    public string IndexChangeMode { get; set; } = "prevClose";
    public DateTime UpdatedAt { get; set; }
}
