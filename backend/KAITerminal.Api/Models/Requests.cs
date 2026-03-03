using KAITerminal.Upstox.Models.Enums;

namespace KAITerminal.Api.Models;

public record struct UpstoxTokenRequest(
    string ApiKey,
    string ApiSecret,
    string RedirectUri,
    string Code);

public record struct SaveBrokerCredentialRequest(
    string BrokerName,
    string ApiKey,
    string ApiSecret);

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
