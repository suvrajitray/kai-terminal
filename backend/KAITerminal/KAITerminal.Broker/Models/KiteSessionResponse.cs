namespace KAITerminal.Broker.Models;

public record KiteSessionResponse(string Status, SessionData Data);
public record SessionData(string AccessToken, string PublicToken, string UserId);
