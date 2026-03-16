using KAITerminal.Api.Models;

namespace KAITerminal.Api.Services;

public interface IAiSentimentService
{
    Task<AiSentimentResponse> GetSentimentAsync(CancellationToken ct = default);
}
