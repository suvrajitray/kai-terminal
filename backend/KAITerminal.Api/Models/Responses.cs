namespace KAITerminal.Api.Models;

public record BrokerCredentialResponse(string BrokerName, string ApiKey, string ApiSecret, string AccessToken);

public record UserTradingSettingsResponse(
    decimal DefaultStoplossPercentage,
    int NiftyShiftOffset,
    int SensexShiftOffset,
    int BankniftyShiftOffset,
    string IndexChangeMode = "prevClose");
