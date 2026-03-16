using KAITerminal.Upstox.Models.Enums;

namespace KAITerminal.Api.Models;

public record struct UpstoxTokenRequest(
    string ApiKey,
    string ApiSecret,
    string RedirectUri,
    string Code);

public record struct UpdateAccessTokenRequest(string AccessToken);

public record struct SaveUserTradingSettingsRequest(
    decimal DefaultStoplossPercentage,
    int NiftyShiftOffset,
    int SensexShiftOffset,
    int BankniftyShiftOffset,
    int FinniftyShiftOffset = 5,
    int BankexShiftOffset = 10,
    string IndexChangeMode = "prevClose");

public record struct SaveBrokerCredentialRequest(
    string BrokerName,
    string ApiKey,
    string ApiSecret,
    string AccessToken = "");

public record struct ConvertPositionRequest(string OldProduct, int Quantity);

public record ResolveByOptionPriceQuery(
    string UnderlyingKey,
    string ExpiryDate,
    OptionType OptionType,
    decimal TargetPremium,
    PriceSearchMode PriceSearchMode = PriceSearchMode.Nearest);

public record ResolveByStrikeQuery(
    string UnderlyingKey,
    string ExpiryDate,
    OptionType OptionType,
    StrikeType StrikeType);
