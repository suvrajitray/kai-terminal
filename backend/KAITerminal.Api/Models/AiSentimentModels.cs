namespace KAITerminal.Api.Models;

public record AiModelResult(
    string Model,
    string Provider,
    string? Direction,
    string? Confidence,
    List<string> Reasons,
    decimal? Support,
    decimal? Resistance,
    string? WatchFor,
    string? Error,
    long LatencyMs);

public record AiSentimentResponse(
    DateTimeOffset GeneratedAt,
    decimal NiftyLtp,
    decimal BankNiftyLtp,
    decimal NiftyPcr,
    List<AiModelResult> Models);
