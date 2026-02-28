namespace KAITerminal.Api.Models;

public record struct ZerodhaTokenRequest(
    string ApiKey,
    string ApiSecret,
    string RequestToken);

public record struct SaveBrokerCredentialRequest(
    string BrokerName,
    string ApiKey,
    string ApiSecret);
