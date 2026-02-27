namespace KAITerminal.Api.Models.Requests;

public record struct ZerodhaTokenRequest(
    string ApiKey,
    string ApiSecret,
    string RequestToken);
