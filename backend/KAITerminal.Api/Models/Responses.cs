namespace KAITerminal.Api.Models;

public record BrokerCredentialResponse(string BrokerName, string ApiKey, string ApiSecret, string AccessToken);

public record UserTradingSettingsResponse(
    decimal DefaultStoplossPercentage,
    int NiftyShiftOffset,
    int BankniftyShiftOffset,
    int MidcpniftyShiftOffset,
    int FinniftyShiftOffset,
    int SensexShiftOffset,
    int BankexShiftOffset);
