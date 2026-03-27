namespace KAITerminal.Api.Models;

public record BrokerCredentialResponse(string BrokerName, string ApiKey, string ApiSecret, string AccessToken);

public record UserTradingSettingsResponse(
    int NiftyShiftOffset,
    int SensexShiftOffset,
    int BankniftyShiftOffset,
    int FinniftyShiftOffset,
    int BankexShiftOffset,
    string IndexChangeMode = "prevClose");
