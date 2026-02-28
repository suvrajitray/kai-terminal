namespace KAITerminal.Api.Models;

public record struct UpstoxTokenRequest(string ApiKey, string ApiSecret, string Code);

public record struct SaveBrokerCredentialRequest(
    string BrokerName,
    string ApiKey,
    string ApiSecret);
