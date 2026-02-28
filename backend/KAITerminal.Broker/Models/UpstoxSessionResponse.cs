namespace KAITerminal.Broker.Models;

public record UpstoxSessionResponse(string Status, UpstoxSessionData Data);
public record UpstoxSessionData(string AccessToken, string UserId, string Email, string UserName);
