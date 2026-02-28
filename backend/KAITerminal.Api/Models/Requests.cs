namespace KAITerminal.Api.Models.Requests;

public record struct ZerodhaTokenRequest(
    string ApiKey,
    string ApiSecret,
    string RequestToken);

public record struct SaveBrokerCredentialRequest(
    string BrokerName,
    string ApiKey,
    string ApiSecret);
