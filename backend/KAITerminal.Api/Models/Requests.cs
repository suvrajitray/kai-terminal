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
    int BankniftyShiftOffset,
    int MidcpniftyShiftOffset,
    int FinniftyShiftOffset,
    int SensexShiftOffset,
    int BankexShiftOffset,
    string IndexChangeMode = "open");

public record struct SaveBrokerCredentialRequest(
    string BrokerName,
    string ApiKey,
    string ApiSecret,
    string AccessToken = "");

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
